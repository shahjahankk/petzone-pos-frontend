'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Provider } from 'react-redux'
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Pagination
} from '@mui/material'
import {
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Receipt as ReceiptIcon,
  Download as DownloadIcon
} from '@mui/icons-material'
import api from '../../../../utils/axios'
import {
  fetchCustomerLedger,
  exportCustomerLedger,
  clearError,
  clearCurrentLedger
} from '../../../store/slices/customerLedgerSlice'

// Inner component that uses Redux
function AllLedgerContent() {
  const dispatch = useDispatch()
  const { currentCustomerLedger, loading, error } = useSelector((state) => state.customerLedger)

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    transactionType: 'all'
  })
  const [page, setPage] = useState(1)
  const [saleItemsOpen, setSaleItemsOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState(null)
  const [saleItems, setSaleItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  const loadAllLedger = useCallback(() => {
    const params = {
      ...filters,
      limit: 100,
      offset: (page - 1) * 100
    }
    dispatch(fetchCustomerLedger({ customerId: '__all__', params }))
  }, [dispatch, filters, page])

  useEffect(() => {
    loadAllLedger()
  }, []) // Load once on mount

  const handleApplyFilters = () => {
    setPage(1)
    loadAllLedger()
  }

  const handleExport = (format = 'pdf', detailed = false) => {
    dispatch(exportCustomerLedger({
      customerId: '__all__',
      params: { ...filters, format, detailed: detailed.toString() }
    }))
  }

  const fetchSaleItems = async (transactionId, transaction = null) => {
    setLoadingItems(true)
    try {
      const isReturn = transaction?.transaction_type === 'RETURN' ||
        transaction?.return_id ||
        (transaction?.invoice_no && transaction.invoice_no.startsWith('RET-'))

      let response
      if (isReturn) {
        const returnId = transaction?.return_id || transactionId
        response = await api.get(`/sales/returns/${returnId}`)
      } else {
        response = await api.get(`/sales/${transactionId}`)
      }

      if (response.data.success) {
        setSelectedSale(response.data.data)
        setSaleItems(response.data.data.items || [])
        setSaleItemsOpen(true)
      }
    } catch (error) {
      console.error('Error loading transaction details:', error)
      alert('Failed to load transaction details')
    } finally {
      setLoadingItems(false)
    }
  }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount || 0)

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const datePart = String(dateString).substring(0, 10)
    const parts = datePart.split('-')
    if (parts.length !== 3) return 'N/A'
    const [year, month, day] = parts
    return `${day}/${month}/${year}`
  }

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'success'
      case 'PARTIAL': return 'warning'
      case 'PENDING': return 'error'
      default: return 'default'
    }
  }

  const groups = currentCustomerLedger?.groupedLedgers || []
  const summary = currentCustomerLedger?.summary || {}
  const uniqueCount = currentCustomerLedger?.customer?.unique_customers ?? groups.length
  const totalRecords = currentCustomerLedger?.pagination?.total || 0

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8fafc', p: 0 }}>
      {/* Header Bar */}
      <Box sx={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        color: 'white',
        px: 4,
        py: 2.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
            📋 All Customers Ledger
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Complete transaction history across all customers
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('pdf', false)}
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            Export PDF
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('pdf', true)}
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            Detailed PDF
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={loadAllLedger} sx={{ color: 'white' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ px: 4, py: 3 }}>
        {/* Filters */}
        <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2 }} elevation={0} variant="outlined">
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth size="small"
                label="Start Date" type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth size="small"
                label="End Date" type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Transaction Type</InputLabel>
                <Select
                  value={filters.transactionType}
                  onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })}
                  label="Transaction Type"
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="COMPLETED">Paid</MenuItem>
                  <MenuItem value="PARTIAL">Partial Payment</MenuItem>
                  <MenuItem value="PENDING">Credit</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth variant="contained" size="medium"
                startIcon={<FilterIcon />}
                onClick={handleApplyFilters}
                sx={{ bgcolor: '#1e293b', '&:hover': { bgcolor: '#334155' } }}
              >
                Apply Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
            {error}
          </Alert>
        )}

        {/* Loading */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Summary Cards */}
        {!loading && groups.length > 0 && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Total Customers', value: uniqueCount, color: '#3b82f6' },
              { label: 'Total Amount', value: formatCurrency(summary.totalAmount), color: '#1e293b' },
              { label: 'Total Paid', value: formatCurrency(summary.totalPaid), color: '#22c55e' },
              { label: 'Outstanding Balance', value: formatCurrency(summary.outstandingBalance), color: '#ef4444' }
            ].map((card) => (
              <Grid item xs={12} sm={6} md={3} key={card.label}>
                <Paper sx={{ p: 2.5, borderRadius: 2, borderLeft: `4px solid ${card.color}` }} elevation={0} variant="outlined">
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
                    {card.label}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: card.color, mt: 0.5 }}>
                    {card.value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Empty state */}
        {!loading && groups.length === 0 && currentCustomerLedger && (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }} elevation={0} variant="outlined">
            <Typography variant="h6" color="text.secondary">No ledger data found</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Try adjusting your filters or refreshing the page.
            </Typography>
          </Paper>
        )}

        {/* Customer Groups */}
        {!loading && groups.map((group, index) => {
          const groupKey = group.customer?.key || `customer-${index}`
          const groupSummary = group.summary || {}
          const transactions = group.transactions || []

          return (
            <Paper key={groupKey} sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }} elevation={0} variant="outlined">
              {/* Customer Header */}
              <Box sx={{
                px: 3, py: 2,
                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 2
              }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    {group.customer?.name || 'Unknown Customer'}
                  </Typography>
                  {group.customer?.phone && (
                    <Typography variant="body2" color="text.secondary">
                      📞 {group.customer.phone}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={`${groupSummary.totalTransactions || 0} Transactions`} size="small" color="primary" />
                  <Chip
                    label={`Balance: ${formatCurrency(groupSummary.outstandingBalance)}`}
                    size="small"
                    color={groupSummary.outstandingBalance > 0 ? 'error' : 'success'}
                  />
                  <Chip label={`Paid: ${formatCurrency(groupSummary.totalPaid)}`} size="small" color="default" />
                </Box>
              </Box>

              {/* Transactions Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Invoice</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Amount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Old Balance</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Total Amount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Payment</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Method</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Balance</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map((transaction, txIndex) => {
                      const currentAmount = parseFloat(transaction.subtotal || transaction.amount || 0)
                      const oldBalance = parseFloat(transaction.old_balance || 0)
                      const totalAmount = parseFloat(transaction.total_amount || 0)
                      let correctedPaid = 0
                      if (transaction.payment_method === 'FULLY_CREDIT' && transaction.payment_type !== 'OUTSTANDING_SETTLEMENT') {
                        correctedPaid = 0
                      } else if (transaction.payment_type === 'OUTSTANDING_SETTLEMENT' || transaction.transaction_type === 'SETTLEMENT') {
                        correctedPaid = parseFloat(transaction.payment_amount || transaction.paid_amount || 0) || 0
                      } else {
                        correctedPaid = parseFloat(transaction.paid_amount || transaction.payment_amount || 0) || 0
                      }
                      const balance = parseFloat(transaction.running_balance || transaction.balance || 0)
                      const isReturn = transaction.transaction_type === 'RETURN'

                      return (
                        <TableRow
                          key={transaction.transaction_id || txIndex}
                          sx={{
                            '&:hover': { backgroundColor: '#f8fafc' },
                            backgroundColor: isReturn ? 'rgba(239,68,68,0.04)' : 'inherit'
                          }}
                        >
                          <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(transaction.transaction_date)}</TableCell>
                          <TableCell sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                            {isReturn && <span style={{ color: '#ef4444', marginRight: 4 }}>↩</span>}
                            {transaction.invoice_no}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.8rem' }}>{formatCurrency(currentAmount)}</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 500 }}>
                            {formatCurrency(oldBalance)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#3b82f6' }}>
                            {formatCurrency(totalAmount)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 500 }}>
                            {formatCurrency(correctedPaid)}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{transaction.payment_method}</TableCell>
                          <TableCell>
                            <Chip
                              label={transaction.payment_status_display || transaction.payment_status}
                              color={getPaymentStatusColor(transaction.payment_status)}
                              size="small"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                color: balance > 0 ? '#ef4444' : balance < 0 ? '#22c55e' : '#64748b'
                              }}
                            >
                              {formatCurrency(balance)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={isReturn ? 'View Return Items' : 'View Sale Items'}>
                              <IconButton
                                size="small"
                                onClick={() => fetchSaleItems(transaction.transaction_id, transaction)}
                                color="primary"
                                disabled={loadingItems}
                              >
                                <ReceiptIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )
        })}

        {/* Pagination */}
        {totalRecords > 100 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={Math.ceil(totalRecords / 100)}
              page={page}
              onChange={(e, p) => { setPage(p); loadAllLedger() }}
              color="primary"
            />
          </Box>
        )}
      </Box>

      {/* Sale Items Overlay */}
      {saleItemsOpen && (
        <Box sx={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <Paper sx={{ width: '90%', maxWidth: 700, maxHeight: '80vh', overflow: 'auto', borderRadius: 2 }}>
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Items — {selectedSale?.invoice_no || 'N/A'}
              </Typography>
              <Button onClick={() => setSaleItemsOpen(false)} size="small">Close</Button>
            </Box>
            <Box sx={{ p: 3 }}>
              {loadingItems ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : saleItems.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item Name</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Discount</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {saleItems.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.itemName || item.name || 'N/A'}</TableCell>
                          <TableCell>{item.sku || 'N/A'}</TableCell>
                          <TableCell align="right">{item.quantity || 0}</TableCell>
                          <TableCell align="right">{parseFloat(item.unitPrice || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">{parseFloat(item.discount || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">{parseFloat(item.total || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary" textAlign="center" py={3}>No items found.</Typography>
              )}
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  )
}

// Page wrapper — no DashboardLayout, no withAuth wrapper, uses Redux Provider from app layout
export default function AllLedgerPage() {
  return <AllLedgerContent />
}