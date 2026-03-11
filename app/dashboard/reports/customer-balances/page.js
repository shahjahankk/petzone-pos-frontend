'use client'

import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Typography, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
  IconButton, Tooltip, Grid, Alert, CircularProgress, Pagination,
  InputAdornment, Avatar
} from '@mui/material'
import {
  Search as SearchIcon, Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon, AccountBalanceWallet as WalletIcon,
  Person as PersonIcon
} from '@mui/icons-material'
import withAuth from '../../../../components/auth/withAuth'
import RouteGuard from '../../../../components/auth/RouteGuard'
import { fetchAllCustomersWithSummaries, clearError } from '../../../store/slices/customerLedgerSlice'

const LIMIT = 25

function CustomerBalancesPage() {
  const dispatch = useDispatch()
  const { customers, loading, error, pagination } = useSelector((state) => state.customerLedger)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')
  const [balanceFilter, setBalanceFilter] = useState('all')
  const [page, setPage] = useState(1)

  // ── Helpers ──────────────────────────────────────────────────
  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v || 0)

  const getBalanceColor     = (b) => b > 0 ? '#ef4444' : b < 0 ? '#22c55e' : '#64748b'
  const getBalanceChipColor = (b) => b > 0 ? 'error'   : b < 0 ? 'success' : 'default'
  const getBalanceLabel     = (b) => b > 0 ? 'Outstanding' : b < 0 ? 'Advance' : 'Cleared'
  const getInitials         = (n) => n ? n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'

  // ── Load ─────────────────────────────────────────────────────
  const loadCustomers = useCallback(() => {
    dispatch(fetchAllCustomersWithSummaries({
      search,
      hasBalance: balanceFilter === 'withBalance' ? 'true' : balanceFilter === 'cleared' ? 'false' : undefined,
      limit: LIMIT,
      offset: (page - 1) * LIMIT,
    }))
  }, [dispatch, search, balanceFilter, page])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  // ── Search ───────────────────────────────────────────────────
  const handleSearch = () => { setSearch(searchInput); setPage(1) }

  // ── View full ledger ─────────────────────────────────────────
  const handleViewLedger = (customer) => {
    const params = new URLSearchParams()
    if (customer.customer_name)  params.set('customer', customer.customer_name)
    if (customer.customer_phone) params.set('phone', customer.customer_phone)
    window.open(`/dashboard/customer-ledger?${params.toString()}`, '_blank', 'width=1400,height=900')
  }

  // ── Page summary (current page only) ─────────────────────────
  const pageSummary = (customers || []).reduce((acc, c) => {
    acc.totalAmount  += parseFloat(c.total_amount        || c.totalAmount        || 0)
    acc.totalPaid    += parseFloat(c.total_paid          || c.totalPaid          || 0)
    acc.totalBalance += parseFloat(c.current_balance || c.outstanding_balance || c.outstandingBalance || c.balance || 0)
    return acc
  }, { totalAmount: 0, totalPaid: 0, totalBalance: 0 })

  const totalPages = Math.ceil((pagination?.total || 0) / LIMIT)

  return (
    <Box sx={{ p: 3, backgroundColor: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <Box sx={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        borderRadius: 3, color: 'white', px: 4, py: 3, mb: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <WalletIcon sx={{ fontSize: 36, opacity: 0.9 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
              Customer Balances
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.3 }}>
              Outstanding amounts, paid amounts and remaining balances
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={loadCustomers} sx={{ color: 'white' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Summary Cards ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Customers', value: pagination?.total ?? (customers?.length || 0), color: '#3b82f6' },
          { label: 'Total Amount',    value: formatCurrency(pageSummary.totalAmount),        color: '#1e293b' },
          { label: 'Total Paid',      value: formatCurrency(pageSummary.totalPaid),          color: '#22c55e' },
          { label: 'Total Balance',   value: formatCurrency(pageSummary.totalBalance),       color: '#ef4444' },
        ].map((card) => (
          <Grid item xs={6} md={3} key={card.label}>
            <Paper sx={{
              p: 2.5, borderRadius: 2,
              borderLeft: `4px solid ${card.color}`,
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)'
            }} elevation={0}>
              <Typography variant="caption" color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
                {card.label}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: card.color, mt: 0.5 }}>
                {card.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── Search + Filter ── */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={0} variant="outlined">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth size="small"
              placeholder="Search by name or phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {[
                { value: 'all',         label: 'All' },
                { value: 'withBalance', label: 'With Balance' },
                { value: 'cleared',     label: 'Cleared' },
              ].map((opt) => (
                <Button
                  key={opt.value} size="small"
                  variant={balanceFilter === opt.value ? 'contained' : 'outlined'}
                  onClick={() => { setBalanceFilter(opt.value); setPage(1) }}
                  sx={{
                    flex: 1,
                    bgcolor:     balanceFilter === opt.value ? '#1e293b' : 'transparent',
                    borderColor: '#cbd5e1',
                    color:       balanceFilter === opt.value ? 'white'   : '#475569',
                    '&:hover':   { bgcolor: balanceFilter === opt.value ? '#334155' : '#f1f5f9' }
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </Box>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth variant="contained" size="medium"
              startIcon={<SearchIcon />} onClick={handleSearch}
              sx={{ bgcolor: '#1e293b', '&:hover': { bgcolor: '#334155' } }}
            >
              Search
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Error ── */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      {/* ── Loading ── */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* ── Table ── */}
      {!loading && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }} elevation={0} variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                  {['#', 'Customer', 'Phone', 'Address', 'Total Amount', 'Paid Amount', 'Balance', 'Status', 'Ledger'].map((h, i) => (
                    <TableCell
                      key={h}
                      align={['Total Amount','Paid Amount','Balance'].includes(h) ? 'right' : ['Status','Ledger'].includes(h) ? 'center' : 'left'}
                      sx={{ fontWeight: 700, color: '#374151', fontSize: '0.8rem' }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(customers || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                      <PersonIcon sx={{ fontSize: 48, color: '#cbd5e1', display: 'block', mx: 'auto', mb: 1 }} />
                      <Typography color="text.secondary">No customers found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  (customers || []).map((customer, index) => {
                    const name    = customer.customer_name    || 'Unknown'
                    const phone   = customer.customer_phone   || '—'
                    const address = customer.customer_address || customer.address || '—'
                    const total   = parseFloat(customer.total_amount        || customer.totalAmount        || 0)
                    const paid    = parseFloat(customer.total_paid          || customer.totalPaid          || 0)
                    const balance = parseFloat(customer.current_balance || customer.outstanding_balance || customer.outstandingBalance || customer.balance || 0)    
                    const rowNum  = (page - 1) * LIMIT + index + 1

                    return (
                      <TableRow
                        key={`${customer.customer_phone}-${customer.customer_name}-${index}`}
                        sx={{ '&:hover': { backgroundColor: '#f8fafc' }, '&:last-child td': { border: 0 } }}
                      >
                        {/* # */}
                        <TableCell sx={{ fontSize: '0.8rem', color: '#94a3b8', width: 40 }}>
                          {rowNum}
                        </TableCell>

                        {/* Name */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 34, height: 34, fontSize: '0.75rem', fontWeight: 700, bgcolor: '#e0e7ff', color: '#4338ca' }}>
                              {getInitials(name)}
                            </Avatar>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                              {name}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Phone */}
                        <TableCell sx={{ fontSize: '0.85rem', color: '#475569' }}>
                          {phone}
                        </TableCell>

                        {/* Address */}
                        <TableCell sx={{ maxWidth: 180 }}>
                          <Typography
                            title={address !== '—' ? address : undefined}
                            sx={{ fontSize: '0.82rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}
                          >
                            {address}
                          </Typography>
                        </TableCell>

                        {/* Total Amount */}
                        <TableCell align="right">
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                            {formatCurrency(total)}
                          </Typography>
                        </TableCell>

                        {/* Paid */}
                        <TableCell align="right">
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#22c55e' }}>
                            {formatCurrency(paid)}
                          </Typography>
                        </TableCell>

                        {/* Balance */}
                        <TableCell align="right">
                          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: getBalanceColor(balance) }}>
                            {formatCurrency(Math.abs(balance))}
                          </Typography>
                        </TableCell>

                        {/* Status */}
                        <TableCell align="center">
                          <Chip
                            label={getBalanceLabel(balance)}
                            color={getBalanceChipColor(balance)}
                            size="small"
                            sx={{ fontSize: '0.72rem', fontWeight: 600, minWidth: 80 }}
                          />
                        </TableCell>

                        {/* View Ledger */}
                        <TableCell align="center">
                          <Tooltip title="View Full Ledger">
                            <IconButton
                              size="small"
                              onClick={() => handleViewLedger(customer)}
                              sx={{ color: '#3b82f6', '&:hover': { backgroundColor: '#eff6ff' } }}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <Box sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              px: 3, py: 2, borderTop: '1px solid #e2e8f0'
            }}>
              <Typography variant="body2" color="text.secondary">
                Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, pagination?.total || 0)} of {pagination?.total || 0} customers
              </Typography>
              <Pagination
                count={totalPages} page={page}
                onChange={(_, p) => setPage(p)}
                color="primary" size="small"
              />
            </Box>
          )}
        </Paper>
      )}
    </Box>
  )
}

function CustomerBalancesPageWrapper() {
  return (
      <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
        <CustomerBalancesPage />
      </RouteGuard>
    
  )
}

export default withAuth(CustomerBalancesPageWrapper)