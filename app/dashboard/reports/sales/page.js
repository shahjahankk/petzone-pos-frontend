'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  Alert, FormControl, InputLabel, Select, MenuItem, TextField,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Menu,
} from '@mui/material'
import {
  Refresh, Assessment, FilterList, Download,
  TrendingUp, TrendingDown, ShoppingCart, Person,
} from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts'
import { fetchSalesReports } from '../../../store/slices/reportsSlice'
import RouteGuard from '../../../../components/auth/RouteGuard'

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    fontFamily: "'DM Sans', sans-serif",
    p: 3,
  },
  header: {
    background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.1) 100%)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 3,
    p: 3,
    mb: 3,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCard: (accent) => ({
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${accent}40`,
    borderLeft: `4px solid ${accent}`,
    borderRadius: 2,
    backdropFilter: 'blur(10px)',
    transition: 'transform 0.2s',
    '&:hover': { transform: 'translateY(-2px)' },
  }),
  paper: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 2,
    backdropFilter: 'blur(10px)',
  },
  filterPaper: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 2,
    p: 2.5,
    mb: 3,
  },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1 },
  value: (color) => ({ color: color || '#fff', fontWeight: 700, fontSize: '1.8rem', mt: 0.5 }),
  sectionTitle: { color: '#fff', fontWeight: 600, fontSize: '1rem', mb: 2 },
  tableHead: { background: 'rgba(99,102,241,0.15)' },
  tableCell: { color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.82rem' },
  tableHeadCell: { color: '#a5b4fc', fontWeight: 700, borderBottom: '1px solid rgba(99,102,241,0.3)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 },
}

const inputSx = {
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
    '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.5)' },
    '&.Mui-focused fieldset': { borderColor: '#6366f1' },
  },
  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.5)' },
  '& .MuiMenuItem-root': { color: '#fff' },
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1e293b', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#fff', fontSize: 12 },
  labelStyle: { color: '#a5b4fc' },
}

export default function SalesReportsPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((s) => s.auth)
  const { salesReports, isLoading, error } = useSelector((s) => s.reports)
  const [exportAnchor, setExportAnchor] = useState(null)

  const [filters, setFilters] = useState({
    branch: 'all', cashier: 'all', period: 'daily',
    dateFrom: new Date(Date.now() - 30 * 86400000),
    dateTo: new Date(),
  })

  const buildParams = () => {
    const p = {
      dateRange: {
        start: filters.dateFrom?.toISOString().split('T')[0],
        end: filters.dateTo?.toISOString().split('T')[0],
      },
    }
    if (filters.branch !== 'all') p.branch = filters.branch
    if (filters.cashier !== 'all') p.cashier = filters.cashier
    return p
  }

  useEffect(() => { dispatch(fetchSalesReports(buildParams())) }, [dispatch, filters])

  const handleFilter = (field, value) => {
    setFilters((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'period') {
        const now = new Date()
        const map = { daily: 7, weekly: 28, monthly: 365, quarterly: 365, yearly: 1825 }
        next.dateFrom = new Date(now - (map[value] || 30) * 86400000)
        next.dateTo = now
      }
      return next
    })
  }

  const salesData = Array.isArray(salesReports?.salesByDate) ? salesReports.salesByDate : []
  const branchData = salesReports?.salesByBranch && !Array.isArray(salesReports.salesByBranch)
    ? Object.entries(salesReports.salesByBranch).map(([branch, d]) => ({ branch, sales: d.sales || 0, transactions: d.transactions || 0 }))
    : []
  const cashierData = salesReports?.salesByCashier && !Array.isArray(salesReports.salesByCashier)
    ? Object.entries(salesReports.salesByCashier).map(([cashier, d]) => ({ cashier, sales: d.sales || 0, transactions: d.transactions || 0 }))
    : []
  const recentSales = Array.isArray(salesReports?.recentSales) ? salesReports.recentSales : []
  const filteredBranch = user?.role === 'WAREHOUSE_KEEPER' ? branchData.filter(i => i.branch === user.warehouseName) : branchData

  const fmt = (v) => Number(v || 0).toLocaleString()

  const handleExportCSV = () => {
    const rows = [['Date', 'Sales'], ...salesData.map(r => [r.date, r.sales])]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    setExportAnchor(null)
  }

  const handleExportPDF = () => {
    const w = window.open('', '_blank')
    w.document.write(`<html><head><title>Sales Report</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#f0f0f0}</style></head><body>
      <h1>Sales Report — ${new Date().toLocaleDateString()}</h1>
      <h3>Summary</h3>
      <p>Total Sales: ${fmt(salesReports?.totalSales)} | Transactions: ${fmt(salesReports?.totalTransactions)} | Avg Ticket: ${fmt(salesReports?.averageTicket)}</p>
      <h3>Sales by Date</h3>
      <table><tr><th>Date</th><th>Sales</th></tr>${salesData.map(r => `<tr><td>${r.date}</td><td>${r.sales}</td></tr>`).join('')}</table>
      </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 400)
    setExportAnchor(null)
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={styles.page}>
          {/* Google Font */}
          <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

          {/* Header */}
          <Box sx={styles.header}>
            <Box>
              <Typography sx={{ color: '#a5b4fc', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 2, mb: 0.5 }}>
                Reports / Sales
              </Typography>
              <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, letterSpacing: '-0.5px' }}>
                Sales Reports
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', mt: 0.5, fontSize: '0.875rem' }}>
                Detailed analytics and performance metrics
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => dispatch(fetchSalesReports(buildParams()))} disabled={isLoading}
                startIcon={<Refresh />} variant="outlined"
                sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', '&:hover': { borderColor: '#6366f1', background: 'rgba(99,102,241,0.1)' } }}>
                Refresh
              </Button>
              <Button onClick={(e) => setExportAnchor(e.currentTarget)} startIcon={<Download />} variant="contained"
                sx={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', '&:hover': { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } }}>
                Export
              </Button>
              <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}
                PaperProps={{ sx: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' } }}>
                <MenuItem onClick={handleExportCSV} sx={{ color: '#fff' }}>Export CSV</MenuItem>
                <MenuItem onClick={handleExportPDF} sx={{ color: '#fff' }}>Export PDF</MenuItem>
              </Menu>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Filters */}
          <Paper sx={styles.filterPaper} elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <FilterList sx={{ color: '#6366f1', fontSize: 18 }} />
              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem' }}>Filters</Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small" sx={inputSx}>
                  <InputLabel>Period</InputLabel>
                  <Select value={filters.period} onChange={(e) => handleFilter('period', e.target.value)} label="Period">
                    {['daily','weekly','monthly','quarterly','yearly'].map(p => <MenuItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              {user?.role === 'ADMIN' && (
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small" sx={inputSx}>
                    <InputLabel>Branch</InputLabel>
                    <Select value={filters.branch} onChange={(e) => handleFilter('branch', e.target.value)} label="Branch">
                      <MenuItem value="all">All Branches</MenuItem>
                      <MenuItem value="main">Main Branch</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker enableAccessibleFieldDOMStructure={false} label="From Date" value={filters.dateFrom}
                  onChange={(d) => handleFilter('dateFrom', d)}
                  slots={{ textField: TextField }}
                  slotProps={{ textField: { fullWidth: true, size: 'small', sx: inputSx } }} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker enableAccessibleFieldDOMStructure={false} label="To Date" value={filters.dateTo}
                  onChange={(d) => handleFilter('dateTo', d)}
                  slots={{ textField: TextField }}
                  slotProps={{ textField: { fullWidth: true, size: 'small', sx: inputSx } }} />
              </Grid>
            </Grid>
          </Paper>

          {/* Summary Cards */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {[
              { label: 'Total Sales', value: fmt(salesReports?.totalSales), accent: '#6366f1', icon: <TrendingUp /> },
              { label: 'Transactions', value: fmt(salesReports?.totalTransactions), accent: '#22d3ee', icon: <ShoppingCart /> },
              { label: 'Avg. Ticket', value: fmt(salesReports?.averageTicket), accent: '#a78bfa', icon: <Assessment /> },
              { label: 'Total Revenue', value: fmt(salesReports?.totalRevenue || salesReports?.totalSales), accent: '#34d399', icon: <TrendingUp /> },
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
            <Grid item xs={12} md={8}>
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={styles.sectionTitle}>
                  {filters.period.charAt(0).toUpperCase() + filters.period.slice(1)} Sales Trend
                </Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={salesData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Line type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={styles.sectionTitle}>
                  {user?.role === 'ADMIN' ? 'Sales by Branch' : 'Warehouse Sales'}
                </Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={filteredBranch} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="branch" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          {/* Tables */}
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Sales by Cashier</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={styles.tableHead}>
                      <TableRow>
                        {['Cashier', 'Sales', 'Transactions'].map(h => (
                          <TableCell key={h} align={h !== 'Cashier' ? 'right' : 'left'} sx={styles.tableHeadCell}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cashierData.length === 0 ? (
                        <TableRow><TableCell colSpan={3} align="center" sx={{ ...styles.tableCell, py: 4 }}>No data available</TableCell></TableRow>
                      ) : cashierData.map((row, i) => (
                        <TableRow key={i} sx={{ '&:hover': { background: 'rgba(99,102,241,0.06)' } }}>
                          <TableCell sx={styles.tableCell}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Person sx={{ fontSize: 16, color: '#6366f1' }} />{row.cashier}</Box></TableCell>
                          <TableCell align="right" sx={{ ...styles.tableCell, color: '#34d399', fontWeight: 600 }}>{Number(row.sales).toLocaleString()}</TableCell>
                          <TableCell align="right" sx={styles.tableCell}>{row.transactions}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Recent Transactions</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={styles.tableHead}>
                      <TableRow>
                        {['Date', 'Amount', 'Cashier', 'Status'].map(h => (
                          <TableCell key={h} sx={styles.tableHeadCell}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentSales.length === 0 ? (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ ...styles.tableCell, py: 4 }}>No recent transactions</TableCell></TableRow>
                      ) : recentSales.slice(0, 8).map((row, i) => (
                        <TableRow key={i} sx={{ '&:hover': { background: 'rgba(99,102,241,0.06)' } }}>
                          <TableCell sx={styles.tableCell}>{row.date || row.created_at}</TableCell>
                          <TableCell sx={{ ...styles.tableCell, color: '#34d399', fontWeight: 600 }}>{Number(row.sales || row.total_amount || 0).toLocaleString()}</TableCell>
                          <TableCell sx={styles.tableCell}>{row.cashier || row.cashier_name || '—'}</TableCell>
                          <TableCell sx={styles.tableCell}><Chip label="Completed" size="small" sx={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', fontSize: '0.7rem', height: 22 }} /></TableCell>
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