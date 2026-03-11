'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  Alert, FormControl, InputLabel, Select, MenuItem, TextField,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material'
import { Refresh, FilterList, Download, AccountBalance, TrendingUp, TrendingDown, Receipt } from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import { fetchLedgerReports } from '../../../store/slices/reportsSlice'
import RouteGuard from '../../../../components/auth/RouteGuard'

const ACCENT = '#f59e0b'
const ACCENT2 = '#fb923c'

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0c0a00 0%, #1c1400 50%, #0c0a00 100%)',
    fontFamily: "'DM Sans', sans-serif",
    p: 3,
  },
  header: {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(251,146,60,0.08) 100%)',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: 3, p: 3, mb: 3,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  statCard: (accent) => ({
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${accent}30`,
    borderLeft: `4px solid ${accent}`,
    borderRadius: 2,
    transition: 'transform 0.2s',
    '&:hover': { transform: 'translateY(-2px)' },
  }),
  paper: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 2,
  },
  filterPaper: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 2, p: 2.5, mb: 3,
  },
  label: { color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1 },
  value: (c) => ({ color: c || '#fff', fontWeight: 700, fontSize: '1.8rem', mt: 0.5 }),
  sectionTitle: { color: '#fff', fontWeight: 600, fontSize: '1rem', mb: 2 },
  tableHead: { background: 'rgba(245,158,11,0.08)' },
  tableCell: { color: 'rgba(255,255,255,0.65)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' },
  tableHeadCell: { color: '#fcd34d', fontWeight: 700, borderBottom: '1px solid rgba(245,158,11,0.25)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 },
}

const inputSx = {
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.5)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1c1400', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, color: '#fff', fontSize: 12 },
}

// ── Fallback chart data if API returns nothing ────────────────────────────────
const MOCK_TREND = [
  { date: 'Jan', debit: 5000, credit: 3000, balance: 2000 },
  { date: 'Feb', debit: 4500, credit: 3500, balance: 3000 },
  { date: 'Mar', debit: 6000, credit: 4000, balance: 5000 },
  { date: 'Apr', debit: 5500, credit: 4500, balance: 6000 },
  { date: 'May', debit: 7000, credit: 5000, balance: 8000 },
]

export default function LedgerReportsPage() {
  const dispatch = useDispatch()
  const { ledgerReports, isLoading, error } = useSelector((s) => s.reports)

  const [filters, setFilters] = useState({
    account: 'all', transactionType: 'all',
    dateFrom: new Date(Date.now() - 30 * 86400000),
    dateTo: new Date(),
  })

  useEffect(() => { dispatch(fetchLedgerReports(filters)) }, [dispatch, filters])

  // Wire up real data with fallback to mock for charts
  const trendData = Array.isArray(ledgerReports?.trendData) && ledgerReports.trendData.length > 0
    ? ledgerReports.trendData
    : MOCK_TREND

  const recentTransactions = Array.isArray(ledgerReports?.recentTransactions)
    ? ledgerReports.recentTransactions
    : []

  const accountSummary = Array.isArray(ledgerReports?.accountSummary)
    ? ledgerReports.accountSummary
    : []

  const handleExport = () => {
    const rows = [
      ['Date', 'Description', 'Account', 'Amount', 'Type'],
      ...recentTransactions.map(r => [r.date, r.description, r.account, r.amount, r.type]),
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `ledger-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const fmt = (v) => Number(v || 0).toLocaleString()

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={styles.page}>
          <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

          {/* Header */}
          <Box sx={styles.header}>
            <Box>
              <Typography sx={{ color: '#fcd34d', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 2, mb: 0.5 }}>
                Reports / Ledger
              </Typography>
              <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700 }}>Ledger Reports</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', mt: 0.5, fontSize: '0.875rem' }}>
                Financial transactions and account balances
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => dispatch(fetchLedgerReports(filters))} disabled={isLoading}
                startIcon={<Refresh />} variant="outlined"
                sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', '&:hover': { borderColor: ACCENT, background: 'rgba(245,158,11,0.08)' } }}>
                Refresh
              </Button>
              <Button onClick={handleExport} startIcon={<Download />} variant="contained"
                sx={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, '&:hover': { background: 'linear-gradient(135deg, #d97706, #ea580c)' } }}>
                Export CSV
              </Button>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Filters */}
          <Paper sx={styles.filterPaper} elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <FilterList sx={{ color: ACCENT, fontSize: 18 }} />
              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem' }}>Filters</Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small" sx={inputSx}>
                  <InputLabel>Account</InputLabel>
                  <Select value={filters.account} onChange={(e) => setFilters(p => ({ ...p, account: e.target.value }))} label="Account">
                    <MenuItem value="all">All Accounts</MenuItem>
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="bank">Bank</MenuItem>
                    <MenuItem value="petty">Petty Cash</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small" sx={inputSx}>
                  <InputLabel>Type</InputLabel>
                  <Select value={filters.transactionType} onChange={(e) => setFilters(p => ({ ...p, transactionType: e.target.value }))} label="Type">
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="debit">Debit</MenuItem>
                    <MenuItem value="credit">Credit</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker label="From Date" value={filters.dateFrom}
                  onChange={(d) => setFilters(p => ({ ...p, dateFrom: d }))}
                  slots={{ textField: TextField }}
                  slotProps={{ textField: { fullWidth: true, size: 'small', sx: inputSx } }} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker label="To Date" value={filters.dateTo}
                  onChange={(d) => setFilters(p => ({ ...p, dateTo: d }))}
                  slots={{ textField: TextField }}
                  slotProps={{ textField: { fullWidth: true, size: 'small', sx: inputSx } }} />
              </Grid>
            </Grid>
          </Paper>

          {/* Summary Cards */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {[
              { label: 'Total Assets', value: fmt(ledgerReports?.totalAssets), accent: '#34d399', icon: <AccountBalance /> },
              { label: 'Total Liabilities', value: fmt(ledgerReports?.totalLiabilities), accent: '#ef4444', icon: <TrendingDown /> },
              { label: 'Net Worth', value: fmt(ledgerReports?.netWorth), accent: ACCENT, icon: <TrendingUp /> },
              { label: 'Transactions', value: fmt(ledgerReports?.totalTransactions), accent: '#a78bfa', icon: <Receipt /> },
            ].map((c) => (
              <Grid item xs={12} sm={6} md={3} key={c.label}>
                <Card sx={styles.statCard(c.accent)} elevation={0}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography sx={styles.label}>{c.label}</Typography>
                        <Typography sx={styles.value(c.accent)}>{c.value}</Typography>
                      </Box>
                      <Box sx={{ color: c.accent, opacity: 0.7 }}>{c.icon}</Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Charts */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} md={7}>
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Balance Trend</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Line name="Balance" type="monotone" dataKey="balance" stroke={ACCENT} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Debit vs Credit</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend iconSize={10} wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                    <Bar name="Debit" dataKey="debit" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={25} />
                    <Bar name="Credit" dataKey="credit" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={25} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          {/* Account Summary + Recent Transactions */}
          <Grid container spacing={2.5}>
            {accountSummary.length > 0 && (
              <Grid item xs={12} md={5}>
                <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                  <Typography sx={styles.sectionTitle}>Account Summary</Typography>
                  <Grid container spacing={1.5}>
                    {accountSummary.map((acc, i) => (
                      <Grid item xs={12} sm={6} key={i}>
                        <Box sx={{ background: 'rgba(255,255,255,0.04)', borderRadius: 2, p: 2, border: '1px solid rgba(255,255,255,0.07)' }}>
                          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{acc.account}</Typography>
                          <Typography sx={{ color: acc.balance < 0 ? '#ef4444' : '#34d399', fontWeight: 700, fontSize: '1.2rem', mt: 0.5 }}>
                            {Math.abs(acc.balance || 0).toLocaleString()}
                          </Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' }}>{acc.transactions} txns</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </Grid>
            )}
            <Grid item xs={12} md={accountSummary.length > 0 ? 7 : 12}>
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Recent Transactions</Typography>
                <TableContainer sx={{ maxHeight: 340 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Date', 'Description', 'Account', 'Amount', 'Type'].map(h => (
                          <TableCell key={h} sx={{ ...styles.tableHeadCell, background: 'rgba(245,158,11,0.08)' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ ...styles.tableCell, py: 6 }}>
                            No transaction data available
                          </TableCell>
                        </TableRow>
                      ) : recentTransactions.map((row, i) => (
                        <TableRow key={i} sx={{ '&:hover': { background: 'rgba(245,158,11,0.04)' } }}>
                          <TableCell sx={styles.tableCell}>{row.date}</TableCell>
                          <TableCell sx={styles.tableCell}>{row.description}</TableCell>
                          <TableCell sx={styles.tableCell}>{row.account}</TableCell>
                          <TableCell sx={{ ...styles.tableCell, fontWeight: 600, color: row.type === 'credit' ? '#34d399' : '#f87171' }}>
                            {Number(row.amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell sx={styles.tableCell}>
                            <Chip label={row.type?.toUpperCase()} size="small" sx={{
                              background: row.type === 'credit' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                              color: row.type === 'credit' ? '#34d399' : '#f87171',
                              fontSize: '0.68rem', height: 20,
                            }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </LocalizationProvider>
    </RouteGuard>
  )
}