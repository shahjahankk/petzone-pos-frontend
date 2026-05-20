'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material'
import { 
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { useParams, useRouter, useSearchParams } from 'next/navigation'  // ← added useSearchParams
import DashboardLayout from '../../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../../components/auth/RoleGuard'
import PermissionCheck from '../../../../../components/auth/PermissionCheck'
import { fetchCustomerLedger, exportCustomerLedger } from '../../../../store/slices/customerLedgerSlice'
import { pickTransactionBalance, pickTransactionOldBalance, formatMoneyOrDash } from '../../../../../utils/ledgerFinance'
import { formatLedgerDate, formatLedgerDateTime, isLedgerBackdated, ledgerInvoiceDateCellTooltip } from '../../../../../utils/ledgerUxDates'

const DetailedCustomerLedgerPage = () => {
  const dispatch = useDispatch()
  const router = useRouter()
  const { customerId } = useParams()           // phone number (unique identifier)
  const searchParams = useSearchParams()        // ← read ?name= query param
  const { currentCustomerLedger, loading, error } = useSelector((state) => state.customerLedger)
  
  // ─── Decode the identifier (phone) and the display name ──────────────────
  const decodedIdentifier = decodeURIComponent(customerId)       // e.g. "0345321113"
  const displayName = searchParams.get('name')
    ? decodeURIComponent(searchParams.get('name'))                // e.g. "hakeem bhai"
    : decodedIdentifier                                           // fallback to phone
  // ─────────────────────────────────────────────────────────────────────────

  const [customerInfo, setCustomerInfo] = useState(null)
  const [transactionsWithItems, setTransactionsWithItems] = useState([])
  const [summaryStats, setSummaryStats] = useState({
    totalTransactions: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalCredit: 0,
    outstandingBalance: 0,
    completedTransactions: 0,
    pendingTransactions: 0,
    partialTransactions: 0
  })

  const loadDetailedLedger = useCallback(async () => {
    setTransactionsWithItems([])
    try {
      const result = await dispatch(fetchCustomerLedger({ 
        customerId: decodedIdentifier,
        params: { detailed: 'true', limit: 2000 }
      })).unwrap()
      
      console.log('🔍 FRONTEND: Received ledger data:', result)
      
      if (result.success && result.data) {
        const txWithItems = result.data.transactions || []
        
        // ✅ Build customerInfo — prefer data from API, fall back to URL params
        const apiCustomer = result.data.customer || {}
        setCustomerInfo({
          customer_name:    apiCustomer.name    || apiCustomer.customer_name    || displayName,
          customer_phone:   apiCustomer.phone   || apiCustomer.customer_phone   || decodedIdentifier,
          customer_email:   apiCustomer.email   || apiCustomer.customer_email   || '',
          customer_address: apiCustomer.address || apiCustomer.customer_address || ''
        })
        
        // Use backend summary
        if (result.data.summary) {
          setSummaryStats({
            totalTransactions:    result.data.summary.totalTransactions    || 0,
            totalAmount:          result.data.summary.totalAmount          || 0,
            totalPaid:            result.data.summary.totalPaid            || 0,
            totalCredit:          result.data.summary.totalCredit          || 0,
            outstandingBalance:   result.data.summary.outstandingBalance   || 0,
            completedTransactions: result.data.summary.completedTransactions || 0,
            pendingTransactions:  result.data.summary.pendingTransactions  || 0,
            partialTransactions:  result.data.summary.partialTransactions  || 0
          })
        } else {
          calculateSummaryStats(txWithItems)
        }
        
        setTransactionsWithItems(txWithItems)
      }
    } catch (error) {
      console.error('Error loading detailed ledger:', error)
    }
  }, [dispatch, decodedIdentifier, displayName])

  useEffect(() => {
    if (customerId) {
      loadDetailedLedger()
    }
  }, [customerId, loadDetailedLedger])

  const calculateSummaryStats = (transactions) => {
    const stats = transactions.reduce((acc, transaction) => {
      const currentAmount = parseFloat(transaction.amount || 0)
      const paidAmount    = parseFloat(transaction.corrected_paid || transaction.paid_amount || 0)
      const balPick = pickTransactionBalance(transaction)
      const balance = balPick !== null ? balPick : parseFloat(transaction.balance || transaction.running_balance || 0)
      
      acc.totalTransactions += 1
      acc.totalAmount       += currentAmount
      acc.totalPaid         += paidAmount
      
      if (balance <= 0) {
        acc.completedTransactions += 1
      } else if (paidAmount > 0 && transaction.payment_method !== 'FULLY_CREDIT') {
        acc.partialTransactions += 1
      } else {
        acc.pendingTransactions += 1
      }
      
      return acc
    }, {
      totalTransactions: 0, totalAmount: 0, totalPaid: 0, totalCredit: 0,
      completedTransactions: 0, pendingTransactions: 0, partialTransactions: 0,
      outstandingBalance: 0
    })
    
    const lastTransaction = transactions[transactions.length - 1]
    const lastBal = lastTransaction ? pickTransactionBalance(lastTransaction) : null
    stats.outstandingBalance = lastBal !== null ? lastBal : (lastTransaction
      ? parseFloat(lastTransaction.running_balance || lastTransaction.balance || 0)
      : 0)
    stats.totalCredit = stats.outstandingBalance
    
    setSummaryStats(stats)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const datePart = String(dateString).substring(0, 10)
    const parts = datePart.split('-')
    if (parts.length !== 3) return 'N/A'
    const [year, month, day] = parts
    return `${day}/${month}/${year}`
  }

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0)
    if (num % 1 === 0) return num.toString()
    return num.toFixed(2)
  }

  const renderNotes = (transaction) => {
    const hasNotes = transaction.notes && String(transaction.notes).trim()
    const hasReturn = transaction.return_reason && String(transaction.return_reason).trim()
    if (!hasNotes && !hasReturn) {
      return (
        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic' }}>
          —
        </Typography>
      )
    }
    return (
      <Box sx={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
        {hasNotes && (
          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            {transaction.notes}
          </Typography>
        )}
        {hasReturn && (
          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'error.main', fontStyle: 'italic' }}>
            ↩ {transaction.return_reason}
          </Typography>
        )}
      </Box>
    )
  }

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'success'
      case 'PARTIAL':   return 'warning'
      case 'PENDING':   return 'error'
      default:          return 'default'
    }
  }

  const getPaymentStatusDisplay = (status) => {
    switch (status) {
      case 'COMPLETED': return 'Paid'
      case 'PARTIAL':   return 'Partial'
      case 'PENDING':   return 'Credit'
      default:          return status || 'N/A'
    }
  }

  const formatPaymentMethod = (paymentMethod) => {
    if (!paymentMethod) return 'N/A'
    const cleanMethod = paymentMethod.replace(/^\d+/, '')
    const map = {
      CASH: 'Cash', CARD: 'Card', BANK_TRANSFER: 'Bank Transfer',
      PARTIAL_PAYMENT: 'Partial Payment', FULLY_CREDIT: 'Credit',
      CHEQUE: 'Cheque', REFUND: 'Refund'
    }
    return map[cleanMethod] || cleanMethod
  }

  const formatPaymentType = (paymentType, paymentMethod) => {
    if (!paymentType) {
      const methodMap = {
        FULLY_CREDIT: 'Fully Credit', PARTIAL_PAYMENT: 'Partial Payment',
        CASH: 'Full Payment', CARD: 'Full Payment', BANK_TRANSFER: 'Full Payment',
        CHEQUE: 'Full Payment', REFUND: 'Refund'
      }
      return methodMap[paymentMethod] || 'N/A'
    }
    const typeMap = {
      FULL_PAYMENT: 'Full Payment', PARTIAL_PAYMENT: 'Partial Payment',
      FULLY_CREDIT: 'Fully Credit', CASH: 'Cash', CARD: 'Card',
      BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', REFUND: 'Refund',
      OUTSTANDING_SETTLEMENT: 'Outstanding Settlement'
    }
    return typeMap[paymentType] || paymentType
  }

  const handlePrint    = () => window.print()
  const handleRefresh  = () => loadDetailedLedger()
  const handleBack     = () => router.back()
  const handleDownload = () => {
    dispatch(exportCustomerLedger({ 
      customerId: decodedIdentifier,
      params: { detailed: true, format: 'pdf' }
    }))
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </DashboardLayout>
    )
  }

const transactions = (
  transactionsWithItems.length > 0
    ? transactionsWithItems
    : (currentCustomerLedger?.transactions || [])
).slice().sort((a, b) => {
  const ta = new Date(a.postedAt || a.created_at || 0).getTime()
  const tb = new Date(b.postedAt || b.created_at || 0).getTime()
  if (ta !== tb) return ta - tb
  return (a.transaction_id || 0) - (b.transaction_id || 0)
});
  
  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
        <PermissionCheck roles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
          <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={handleBack} color="primary">
                  <ArrowBackIcon />
                </IconButton>
                {/* ✅ Shows "hakeem bhai" (from ?name=) not the phone number */}
                <Typography variant="h4" component="h1">
                  Detailed Customer Ledger: {customerInfo?.customer_name || displayName}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Refresh">
                  <IconButton onClick={handleRefresh} color="primary"><RefreshIcon /></IconButton>
                </Tooltip>
                <Tooltip title="Print">
                  <IconButton onClick={handlePrint} color="primary"><PrintIcon /></IconButton>
                </Tooltip>
                <Tooltip title="Download PDF">
                  <IconButton onClick={handleDownload} color="secondary"><DownloadIcon /></IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Customer Info */}
            {customerInfo && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Customer Information</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Name:</strong> {customerInfo.customer_name || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Phone:</strong> {customerInfo.customer_phone || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Email:</strong> {customerInfo.customer_email || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Address:</strong> {customerInfo.customer_address || 'N/A'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Summary Statistics */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {[
                { label: 'Total Transactions', value: summaryStats.totalTransactions, color: 'text.primary' },
                { label: 'Total Amount',        value: formatCurrency(summaryStats.totalAmount),        color: 'text.primary' },
                { label: 'Total Paid',          value: formatCurrency(summaryStats.totalPaid),          color: 'success.main' },
                { label: 'Outstanding Balance', value: formatCurrency(summaryStats.outstandingBalance), color: 'error.main' }
              ].map(({ label, value, color }) => (
                <Grid item xs={12} sm={6} md={3} key={label}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>{label}</Typography>
                      <Typography variant="h5" component="div" color={color}>{value}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Transaction Status Summary */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {[
                { label: 'Completed', value: summaryStats.completedTransactions, color: 'success.main' },
                { label: 'Partial',   value: summaryStats.partialTransactions,   color: 'warning.main' },
                { label: 'Pending',   value: summaryStats.pendingTransactions,   color: 'error.main'   }
              ].map(({ label, value, color }) => (
                <Grid item xs={12} sm={4} key={label}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>{label}</Typography>
                      <Typography variant="h6" component="div" color={color}>{value}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Detailed Transactions Table */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Transaction Details</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, maxWidth: 720 }}>
                  (Backdated) appears when the invoice business date and the posting date fall on different calendar days. It is not tied to any date picker on this screen.
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['Invoice Date','Posted On','Invoice','Notes','Items','Amount','Old Balance','Total Amount',
                          'Payment','Payment Method','Payment Type','Status','Balance'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 'bold', textAlign: ['Amount','Old Balance','Total Amount','Payment','Balance'].includes(h) ? 'right' : 'left' }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Tooltip title={ledgerInvoiceDateCellTooltip(transaction)}>
                              <span>
                                {isLedgerBackdated(transaction) ? (
                                  <Typography component="span" sx={{ color: '#f57c00', fontWeight: 600 }}>
                                    {formatLedgerDate(transaction.invoiceDate || transaction.transaction_date)}
                                    {' '}(Backdated)
                                  </Typography>
                                ) : (
                                  formatLedgerDate(transaction.invoiceDate || transaction.transaction_date)
                                )}
                              </span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                            <Tooltip title={`Posted on ${formatLedgerDateTime(transaction.postedAt || transaction.created_at)}`}>
                              <span>{formatLedgerDateTime(transaction.postedAt || transaction.created_at)}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {transaction.invoice_no || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ minWidth: 120, maxWidth: 220, verticalAlign: 'top' }}>
                            {renderNotes(transaction)}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                              {transaction.items && transaction.items.length > 0 ? (
                                transaction.items.map((item, i) => {
                                  const itemName  = item.item_name ?? item.name ?? 'N/A'
                                  const quantity  = parseFloat(item.quantity ?? 0)
                                  const unitPrice = parseFloat(item.unitPrice ?? item.unit_price ?? 0)
                                  const total     = parseFloat(item.total ?? (quantity * unitPrice))
                                  const isFallback = String(itemName).includes('not stored') ||
                                    String(itemName).includes('settlement') ||
                                    String(itemName).includes('Return / refund')
                                  return (
                                    <Box
                                      key={i}
                                      sx={{
                                        mb: 0.5,
                                        pb: 0.5,
                                        borderBottom: '1px solid #f0f0f0',
                                        color: isFallback ? 'text.secondary' : 'inherit',
                                        fontStyle: isFallback ? 'italic' : 'normal',
                                      }}
                                    >
                                      {isFallback
                                        ? `${itemName} = ${formatCurrency(total)}`
                                        : `${itemName} (${quantity}x) @ ${formatCurrency(unitPrice)} = ${formatCurrency(total)}`}
                                    </Box>
                                  )
                                })
                              ) : (
                                <Box sx={{ color: 'text.secondary', fontStyle: 'italic' }}>No items</Box>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace">
                              {formatCurrency(transaction.amount || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace" color="warning.main">
                              {formatMoneyOrDash(pickTransactionOldBalance(transaction), formatCurrency)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace" fontWeight="bold" color="primary.main">
                              {formatCurrency(transaction.total_amount || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace" color="success.main">
                              {formatCurrency(transaction.corrected_paid || transaction.paid_amount || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell>{formatPaymentMethod(transaction.payment_method)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                              {formatPaymentType(transaction.payment_type, transaction.payment_method)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getPaymentStatusDisplay(transaction.payment_status)}
                              color={getPaymentStatusColor(transaction.payment_status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography 
                              variant="body2" fontFamily="monospace"
                              color={(() => {
                                const b = pickTransactionBalance(transaction)
                                const n = b !== null ? b : parseFloat(transaction.running_balance || transaction.balance || 0)
                                return n > 0 ? 'error.main' : 'success.main'
                              })()}
                            >
                              {formatMoneyOrDash(pickTransactionBalance(transaction), formatCurrency)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Grand Total Row */}
                      <TableRow sx={{ 
                        backgroundColor: '#f5f5f5', borderTop: '2px solid #ccc',
                        '& .MuiTableCell-root': { fontWeight: 'bold', fontSize: '0.875rem', py: 2 }
                      }}>
                        <TableCell colSpan={5}>GRAND TOTAL</TableCell>
                        <TableCell align="right">{formatCurrency(summaryStats.totalAmount)}</TableCell>
                        <TableCell align="right">—</TableCell>
                        <TableCell align="right">
                          {formatCurrency(transactions.reduce((s, t) => s + parseFloat(t.total_amount || 0), 0))}
                        </TableCell>
                        <TableCell align="right">{formatCurrency(summaryStats.totalPaid)}</TableCell>
                        <TableCell align="center" colSpan={2}>—</TableCell>
                        <TableCell align="center">
                          <Chip label={`${summaryStats.completedTransactions} Completed`} size="small" color="success" />
                        </TableCell>
                        <TableCell align="right" sx={{ color: summaryStats.outstandingBalance > 0 ? 'error.main' : 'success.main' }}>
                          {formatCurrency(summaryStats.outstandingBalance)}
                        </TableCell>
                      </TableRow>

                      {/* Status Summary Row */}
                      <TableRow sx={{ backgroundColor: '#fafafa', '& .MuiTableCell-root': { fontSize: '0.813rem', py: 1.5 } }}>
                        <TableCell colSpan={4}>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <Typography variant="body2" component="span" sx={{ fontWeight: 'bold' }}>Summary:</Typography>
                            {[
                              { label: `Completed: ${summaryStats.completedTransactions}`, color: 'success' },
                              { label: `Partial: ${summaryStats.partialTransactions}`,     color: 'warning' },
                              { label: `Pending: ${summaryStats.pendingTransactions}`,     color: 'error'   },
                              { label: `Total Txns: ${summaryStats.totalTransactions}`,    color: 'info'    }
                            ].map(({ label, color }) => (
                              <Chip key={label} label={label} size="small" color={color} variant="outlined" />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell colSpan={9} align="right">
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                            Last Updated: {new Date().toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        </PermissionCheck>
      </RouteGuard>

      <style jsx global>{`
        @media print {
          .MuiAppBar-root, .MuiDrawer-root, button, .MuiIconButton-root { display: none !important; }
          .MuiBox-root { padding: 0 !important; }
          .MuiTableRow-root { page-break-inside: avoid; }
        }
      `}</style>
    </DashboardLayout>
  )
}

export default DetailedCustomerLedgerPage