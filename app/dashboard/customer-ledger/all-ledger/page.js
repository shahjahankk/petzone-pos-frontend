'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Typography, TextField, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Tooltip, FormControl, InputLabel, Select, MenuItem, Grid,
  Alert, CircularProgress, Pagination
} from '@mui/material'
import { FilterList as FilterIcon, Refresh as RefreshIcon, Download as DownloadIcon } from '@mui/icons-material'
import {
  fetchCustomerLedger, exportCustomerLedger, clearError
} from '../../../store/slices/customerLedgerSlice'

function AllLedgerContent() {
  const dispatch = useDispatch()
  const { currentCustomerLedger, loading, error } = useSelector((state) => state.customerLedger)
  const [filters, setFilters] = useState({ startDate: '', endDate: '', transactionType: 'all' })
  const [page, setPage] = useState(1)

  const loadAllLedger = useCallback(() => {
    dispatch(fetchCustomerLedger({
      customerId: '__all__',
      params: { ...filters, detailed: 'true', limit: 100, offset: (page - 1) * 100 }
    }))
  }, [dispatch, filters, page])

  useEffect(() => { loadAllLedger() }, [])

  const handleApplyFilters = () => { setPage(1); loadAllLedger() }

  const handleExport = (format = 'pdf', detailed = false) =>
    dispatch(exportCustomerLedger({ customerId: '__all__', params: { ...filters, format, detailed: detailed.toString() } }))

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount || 0)

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const p = String(dateString).substring(0, 10).split('-')
    return p.length !== 3 ? 'N/A' : `${p[2]}/${p[1]}/${p[0]}`
  }

  const getTxType = (t) => {
    if (t.transaction_type === 'RETURN') return { label: 'Return', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
    if (t.transaction_type === 'SETTLEMENT' || t.payment_type === 'OUTSTANDING_SETTLEMENT') return { label: 'Outstanding Settlement', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' }
    if (t.payment_type === 'CREDIT_REFUND_SETTLEMENT' || t.payment_method === 'CASH_REFUND') return { label: 'Credit Refund Settlement', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' }
    if (t.payment_type === 'BALANCE_PAYMENT') return { label: 'Balance Payment', color: '#10b981', bg: 'rgba(16,185,129,0.1)' }
    if (t.payment_method === 'FULLY_CREDIT') return { label: 'Fully Credit', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    if (t.payment_status === 'PARTIAL') return { label: 'Partial Payment', color: '#f97316', bg: 'rgba(249,115,22,0.1)' }
    return { label: 'Cash', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' }
  }

  const getStatus = (t) => {
    const bal = parseFloat(t.running_balance || t.balance || 0)
    if (t.payment_method === 'FULLY_CREDIT' && t.payment_type !== 'OUTSTANDING_SETTLEMENT') return { label: 'Credit', color: '#ef4444', bg: '#fef2f2' }
    if (bal <= 0.01) return { label: 'Paid', color: '#16a34a', bg: '#f0fdf4' }
    if (t.payment_status === 'PARTIAL') return { label: 'Partial', color: '#d97706', bg: '#fffbeb' }
    return { label: 'Credit', color: '#ef4444', bg: '#fef2f2' }
  }

  const renderItems = (items) => {
    if (!items || items.length === 0) return <Typography sx={{ fontSize: '0.73rem', color: '#94a3b8', fontStyle: 'italic' }}>No items</Typography>
    return items.map((item, i) => {
      const name = item.item_name || item.name || 'Unknown'
      const qty = parseFloat(item.quantity || 0)
      const price = parseFloat(item.unit_price || 0)
      const total = parseFloat(item.total || item.refund_amount || (qty * price) || 0)
      return (
        <Typography key={i} sx={{ fontSize: '0.73rem', color: '#374151', lineHeight: 1.7 }}>
          {name} ({qty}x) @ {formatCurrency(price)} = <strong>{formatCurrency(total)}</strong>
        </Typography>
      )
    })
  }

  const getPaid = (t) => {
    if (t.payment_method === 'FULLY_CREDIT' && t.payment_type !== 'OUTSTANDING_SETTLEMENT') return 0
    if (t.payment_type === 'OUTSTANDING_SETTLEMENT' || t.transaction_type === 'SETTLEMENT')
      return parseFloat(t.payment_amount || t.paid_amount || 0) || 0
    return parseFloat(t.paid_amount || t.payment_amount || 0) || 0
  }

  // ── Sort transactions ascending by date then invoice number ───────────────
  // This ensures the ledger reads chronologically: first invoice at top,
  // latest invoice at bottom — like a proper account statement.
  const sortTransactionsAsc = (transactions) => {
    if (!transactions || transactions.length === 0) return []
    return [...transactions].sort((a, b) => {
      // Primary sort: transaction date ascending (oldest first)
      const dateA = new Date(a.transaction_date || a.created_at || 0).getTime()
      const dateB = new Date(b.transaction_date || b.created_at || 0).getTime()
      if (dateA !== dateB) return dateA - dateB

      // Secondary sort: invoice number ascending (e.g. PZ-000007 before PZ-000011)
      const invoiceA = a.invoice_no || ''
      const invoiceB = b.invoice_no || ''

      // Extract numeric part from invoice for proper numeric sort
      const numA = parseInt(invoiceA.replace(/\D/g, '') || '0', 10)
      const numB = parseInt(invoiceB.replace(/\D/g, '') || '0', 10)
      if (numA !== numB) return numA - numB

      // Fallback: transaction_id ascending
      return (a.transaction_id || 0) - (b.transaction_id || 0)
    })
  }

  const groups = currentCustomerLedger?.groupedLedgers || []
  const totalRecords = currentCustomerLedger?.pagination?.total || 0
  const uniqueCount = currentCustomerLedger?.customer?.unique_customers ?? groups.length

  const grandTotals = groups.reduce((acc, g) => {
    const gs = g.summary || {}
    return {
      totalAmount: acc.totalAmount + (parseFloat(gs.totalAmount) || 0),
      totalPaid: acc.totalPaid + (parseFloat(gs.totalPaid) || 0),
      outstandingBalance: acc.outstandingBalance + (parseFloat(gs.outstandingBalance) || 0),
      totalTransactions: acc.totalTransactions + (parseInt(gs.totalTransactions) || 0),
      completedTransactions: acc.completedTransactions + (parseInt(gs.completedTransactions) || 0),
    }
  }, { totalAmount: 0, totalPaid: 0, outstandingBalance: 0, totalTransactions: 0, completedTransactions: 0 })

  const H = { fontWeight: 700, color: '#475569', fontSize: '0.72rem', whiteSpace: 'nowrap', py: 1, px: 1.5, backgroundColor: '#f1f5f9' }
  const C = { fontSize: '0.78rem', py: 0.8, px: 1.5, verticalAlign: 'top' }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>

      {/* Header */}
      <Box sx={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: 'white', px: 4, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>📋 All Customers Ledger</Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>Complete transaction history across all customers</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {[['Export PDF', false], ['Detailed PDF', true]].map(([label, det]) => (
            <Button key={label} variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => handleExport('pdf', det)}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}>
              {label}
            </Button>
          ))}
          <Tooltip title="Refresh"><IconButton onClick={loadAllLedger} sx={{ color: 'white' }}><RefreshIcon /></IconButton></Tooltip>
        </Box>
      </Box>

      <Box sx={{ px: 4, py: 3 }}>

        {/* Filters */}
        <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2 }} elevation={0} variant="outlined">
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" label="Start Date" type="date" value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" label="End Date" type="date" value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Transaction Type</InputLabel>
                <Select value={filters.transactionType} onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })} label="Transaction Type">
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="COMPLETED">Paid</MenuItem>
                  <MenuItem value="PARTIAL">Partial Payment</MenuItem>
                  <MenuItem value="PENDING">Credit</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button fullWidth variant="contained" size="medium" startIcon={<FilterIcon />} onClick={handleApplyFilters}
                sx={{ bgcolor: '#1e293b', '&:hover': { bgcolor: '#334155' } }}>
                Apply Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>{error}</Alert>}
        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}

        {/* Summary Cards */}
        {!loading && groups.length > 0 && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Total Customers',    value: uniqueCount,                                  color: '#3b82f6' },
              { label: 'Total Amount',       value: formatCurrency(grandTotals.totalAmount),      color: '#1e293b' },
              { label: 'Total Paid',         value: formatCurrency(grandTotals.totalPaid),        color: '#22c55e' },
              { label: 'Outstanding Balance',value: formatCurrency(grandTotals.outstandingBalance), color: '#ef4444' },
            ].map((card) => (
              <Grid item xs={12} sm={6} md={3} key={card.label}>
                <Paper sx={{ p: 2.5, borderRadius: 2, borderLeft: `4px solid ${card.color}` }} elevation={0} variant="outlined">
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
                    {card.label}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: card.color, mt: 0.5 }}>{card.value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        {!loading && groups.length === 0 && currentCustomerLedger && (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }} elevation={0} variant="outlined">
            <Typography variant="h6" color="text.secondary">No ledger data found</Typography>
          </Paper>
        )}

        {/* Customer Groups */}
        {!loading && groups.map((group, gIdx) => {
          const gs = group.summary || {}

          // ── Sort transactions ascending so first invoice shows at top ──────
          const transactions = sortTransactionsAsc(group.transactions || [])

          const custTotals = transactions.reduce((acc, t) => ({
            amount: acc.amount + parseFloat(t.amount || t.subtotal || 0),
            paid:   acc.paid   + getPaid(t),
          }), { amount: 0, paid: 0 })

          // Running balance after last transaction (last row after ascending sort)
          const lastBalance = transactions.length > 0
            ? parseFloat(transactions[transactions.length - 1]?.running_balance || transactions[transactions.length - 1]?.balance || 0)
            : 0

          return (
            <Paper key={group.customer?.key || gIdx} sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }} elevation={0} variant="outlined">

              {/* Customer Header */}
              <Box sx={{ px: 3, py: 2, background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>{group.customer?.name || 'Unknown Customer'}</Typography>
                  {group.customer?.phone && <Typography variant="body2" color="text.secondary">📞 {group.customer.phone}</Typography>}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={`${gs.totalTransactions || 0} Transactions`} size="small" color="primary" />
                  <Chip label={`Balance: ${formatCurrency(gs.outstandingBalance)}`} size="small" color={gs.outstandingBalance > 0 ? 'error' : 'success'} />
                  <Chip label={`Paid: ${formatCurrency(gs.totalPaid)}`} size="small" />
                </Box>
              </Box>

              {/* Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {/* Added # serial column */}
                      {['#', 'Date', 'Invoice', 'Items', 'Amount', 'Old Balance', 'Total Amount', 'Payment', 'Method', 'Transaction Type', 'Status', 'Balance'].map(h => (
                        <TableCell key={h} sx={H}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map((t, tIdx) => {
                      const amount   = parseFloat(t.amount || t.subtotal || 0)
                      const oldBal   = parseFloat(t.old_balance || 0)
                      const totalAmt = parseFloat(t.total_amount || 0)
                      const paid     = getPaid(t)
                      const balance  = parseFloat(t.running_balance || t.balance || 0)
                      const isReturn = t.transaction_type === 'RETURN'
                      const txType   = getTxType(t)
                      const status   = getStatus(t)

                      return (
                        <TableRow key={t.transaction_id || tIdx}
                          sx={{ '&:hover': { backgroundColor: '#f8fafc' }, backgroundColor: isReturn ? 'rgba(239,68,68,0.04)' : 'inherit' }}>
                          {/* Serial number — 1-based, ascending */}
                          <TableCell sx={{ ...C, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {tIdx + 1}
                          </TableCell>
                          <TableCell sx={{ ...C, whiteSpace: 'nowrap' }}>{formatDate(t.transaction_date)}</TableCell>
                          <TableCell sx={{ ...C, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {isReturn && <span style={{ color: '#ef4444', marginRight: 4 }}>↩</span>}
                            {t.invoice_no}
                          </TableCell>
                          <TableCell sx={{ ...C, minWidth: 180, maxWidth: 260 }}>{renderItems(t.items)}</TableCell>
                          <TableCell sx={{ ...C, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(amount)}</TableCell>
                          <TableCell sx={{ ...C, textAlign: 'right', color: '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(oldBal)}</TableCell>
                          <TableCell sx={{ ...C, textAlign: 'right', fontWeight: 700, color: '#3b82f6', whiteSpace: 'nowrap' }}>{formatCurrency(totalAmt)}</TableCell>
                          <TableCell sx={{ ...C, textAlign: 'right', color: '#22c55e', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(paid)}</TableCell>
                          <TableCell sx={{ ...C, whiteSpace: 'nowrap' }}>{t.payment_method || 'N/A'}</TableCell>
                          <TableCell sx={C}>
                            <Box sx={{ display: 'inline-block', px: 1, py: 0.3, borderRadius: 1, backgroundColor: txType.bg, color: txType.color, fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {txType.label}
                            </Box>
                          </TableCell>
                          <TableCell sx={C}>
                            <Box sx={{ display: 'inline-block', px: 1.2, py: 0.3, borderRadius: 1, backgroundColor: status.bg, color: status.color, fontSize: '0.72rem', fontWeight: 700 }}>
                              {status.label}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ ...C, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: balance > 0 ? '#ef4444' : balance < 0 ? '#22c55e' : '#64748b' }}>
                            {formatCurrency(balance)}
                          </TableCell>
                        </TableRow>
                      )
                    })}

                    {/* Per-customer total row */}
                    <TableRow sx={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #cbd5e1' }}>
                      <TableCell sx={{ ...C, fontWeight: 700, color: '#1e293b', fontSize: '0.8rem' }} />
                      <TableCell colSpan={3} sx={{ ...C, fontWeight: 700, color: '#1e293b', fontSize: '0.8rem' }}>
                        {group.customer?.name || 'Total'}
                      </TableCell>
                      <TableCell sx={{ ...C, textAlign: 'right', fontWeight: 700 }}>{formatCurrency(custTotals.amount)}</TableCell>
                      <TableCell sx={{ ...C, textAlign: 'right', color: '#94a3b8' }}>—</TableCell>
                      <TableCell sx={{ ...C, textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>{formatCurrency(gs.totalAmount)}</TableCell>
                      <TableCell sx={{ ...C, textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{formatCurrency(gs.totalPaid)}</TableCell>
                      <TableCell sx={C}>—</TableCell>
                      <TableCell sx={C}>—</TableCell>
                      <TableCell sx={C}>
                        <Box sx={{ display: 'inline-block', px: 1.2, py: 0.3, borderRadius: 1, backgroundColor: '#f0fdf4', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700 }}>
                          {gs.completedTransactions || 0} Completed
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...C, textAlign: 'right', fontWeight: 700, color: lastBalance > 0 ? '#ef4444' : '#16a34a' }}>
                        {formatCurrency(lastBalance)}
                      </TableCell>
                    </TableRow>

                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )
        })}

        {/* Grand Total */}
        {!loading && groups.length > 0 && (
          <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: '2px solid #1e293b', mb: 3 }} elevation={2}>
            <Box sx={{ px: 3, py: 1.5, background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'white', letterSpacing: 1 }}>GRAND TOTAL</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                    {/* # + col 1-3 */}
                    <TableCell colSpan={4} sx={{ ...C, fontWeight: 700, color: '#475569' }}>
                      {grandTotals.totalTransactions} Transactions across {uniqueCount} Customers
                    </TableCell>
                    {/* Amount */}
                    <TableCell sx={{ ...C, textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                      <Typography variant="caption" display="block" sx={{ fontSize: '0.63rem', color: '#94a3b8' }}>TOTAL AMOUNT</Typography>
                      {formatCurrency(grandTotals.totalAmount)}
                    </TableCell>
                    {/* Old bal */}
                    <TableCell sx={{ ...C, textAlign: 'right', color: '#94a3b8' }}>—</TableCell>
                    {/* Total amt */}
                    <TableCell sx={{ ...C, textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>
                      <Typography variant="caption" display="block" sx={{ fontSize: '0.63rem', color: '#94a3b8' }}>TOTAL</Typography>
                      {formatCurrency(grandTotals.totalAmount)}
                    </TableCell>
                    {/* Paid */}
                    <TableCell sx={{ ...C, textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                      <Typography variant="caption" display="block" sx={{ fontSize: '0.63rem', color: '#94a3b8' }}>TOTAL PAID</Typography>
                      {formatCurrency(grandTotals.totalPaid)}
                    </TableCell>
                    <TableCell sx={C} />
                    <TableCell sx={C} />
                    {/* Completed */}
                    <TableCell sx={C}>
                      <Box sx={{ display: 'inline-block', px: 1.2, py: 0.3, borderRadius: 1, backgroundColor: '#f0fdf4', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700 }}>
                        {grandTotals.completedTransactions} Completed
                      </Box>
                    </TableCell>
                    {/* Outstanding */}
                    <TableCell sx={{ ...C, textAlign: 'right', fontWeight: 700, color: grandTotals.outstandingBalance > 0 ? '#ef4444' : '#16a34a' }}>
                      <Typography variant="caption" display="block" sx={{ fontSize: '0.63rem', color: '#94a3b8' }}>OUTSTANDING</Typography>
                      {formatCurrency(grandTotals.outstandingBalance)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Pagination */}
        {totalRecords > 100 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination count={Math.ceil(totalRecords / 100)} page={page} color="primary"
              onChange={(e, p) => { setPage(p); loadAllLedger() }} />
          </Box>
        )}

      </Box>
    </Box>
  )
}

export default function AllLedgerPage() {
  return <AllLedgerContent />
}