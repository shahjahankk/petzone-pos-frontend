'use client'

import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  Alert, FormControl, InputLabel, Select, MenuItem, TextField,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Menu, Divider, CircularProgress, Tooltip as MuiTooltip,
} from '@mui/material'
import {
  Refresh, FilterList, Download, TrendingUp, TrendingDown,
  ShoppingCart, Person, AttachMoney, Receipt, PieChart as PieIcon,
  Assessment, CalendarToday, BarChart as BarIcon,
} from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { fetchSalesReports, fetchFinancialReports } from '../../../store/slices/reportsSlice'
import RouteGuard from '../../../../components/auth/RouteGuard'
import api from '../../../utils/axios'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v, decimals = 0) =>
  Number(v || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

const fmtPKR = (v) => `PKR ${fmt(v)}`

const today = () => new Date()
const startOfMonth = () => {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}
const daysAgo = (n) => new Date(Date.now() - n * 86400000)

const toDateStr = (d) => {
  if (!d) return null
  if (d instanceof Date) return d.toISOString().split('T')[0]
  return d
}

// Preset ranges
const PRESETS = {
  today: { label: 'Today', from: () => today(), to: () => today() },
  this_month: { label: 'This Month', from: startOfMonth, to: today },
  last_7: { label: 'Last 7 Days', from: () => daysAgo(7), to: today },
  last_30: { label: 'Last 30 Days', from: () => daysAgo(30), to: today },
  last_90: { label: 'Last 3 Months', from: () => daysAgo(90), to: today },
  custom: { label: 'Custom Range', from: null, to: null },
}

const PIE_COLORS = ['#1976d2', '#42a5f5', '#1565c0', '#64b5f6', '#0d47a1', '#90caf9']

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    color: '#333',
    fontSize: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon, trend, trendLabel }) {
  const isPositiveTrend = trend > 0
  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 2,
        height: '100%',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}
            >
              {label}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: 'text.primary' }}>
              {value}
            </Typography>
            {sub && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {sub}
              </Typography>
            )}
            {trendLabel && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                {isPositiveTrend ? (
                  <TrendingUp sx={{ fontSize: 14, color: 'success.main' }} />
                ) : (
                  <TrendingDown sx={{ fontSize: 14, color: 'error.main' }} />
                )}
                <Typography
                  variant="caption"
                  sx={{ color: isPositiveTrend ? 'success.main' : 'error.main', fontWeight: 600 }}
                >
                  {trendLabel}
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              bgcolor: `${accent}15`,
              borderRadius: '50%',
              p: 1.2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ color: accent, display: 'flex' }}>{icon}</Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, icon }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
        {title}
      </Typography>
    </Box>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalesReportPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((s) => s.auth)
  const { salesReports, financialReports, isLoading, error } = useSelector((s) => s.reports)

  const [exportAnchor, setExportAnchor] = useState(null)
  const [activePreset, setActivePreset] = useState('this_month')
  const [financialLoading, setFinancialLoading] = useState(false)
  const [voucherData, setVoucherData] = useState(null)

  const [filters, setFilters] = useState({
    dateFrom: startOfMonth(),
    dateTo: today(),
    branch: 'all',
    cashier: 'all',
  })

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const buildSalesParams = useCallback(() => ({
    dateRange: {
      start: toDateStr(filters.dateFrom),
      end: toDateStr(filters.dateTo),
    },
    ...(filters.branch !== 'all' && { branch: filters.branch }),
    ...(filters.cashier !== 'all' && { cashier: filters.cashier }),
  }), [filters])

  const buildFinancialParams = useCallback(() => ({
    dateFrom: toDateStr(filters.dateFrom),
    dateTo: toDateStr(filters.dateTo),
  }), [filters])

  // Fetch financial vouchers separately for expense breakdown
  const fetchVoucherSummary = useCallback(async () => {
    try {
      setFinancialLoading(true)
      const params = new URLSearchParams()
      if (filters.dateFrom) params.append('dateFrom', toDateStr(filters.dateFrom))
      if (filters.dateTo) params.append('dateTo', toDateStr(filters.dateTo))

      const [summaryRes, paymentRes] = await Promise.all([
        api.get(`/financial-vouchers/summary?${params}`),
        api.get(`/financial-vouchers/payment-method-summary?${params}`),
      ])
      setVoucherData({
        summary: summaryRes.data?.data || null,
        paymentMethods: paymentRes.data?.data || [],
      })
    } catch {
      setVoucherData(null)
    } finally {
      setFinancialLoading(false)
    }
  }, [filters])

  const loadAll = useCallback(() => {
    dispatch(fetchSalesReports(buildSalesParams()))
    dispatch(fetchFinancialReports(buildFinancialParams()))
    fetchVoucherSummary()
  }, [dispatch, buildSalesParams, buildFinancialParams, fetchVoucherSummary])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // ── Preset handler ─────────────────────────────────────────────────────────
  const applyPreset = (key) => {
    if (key === 'custom') {
      setActivePreset('custom')
      return
    }
    const p = PRESETS[key]
    setActivePreset(key)
    setFilters((prev) => ({ ...prev, dateFrom: p.from(), dateTo: p.to() }))
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const salesData = Array.isArray(salesReports?.salesByDate) ? salesReports.salesByDate : []
  const recentSales = Array.isArray(salesReports?.recentSales) ? salesReports.recentSales : []
  const cashierData = salesReports?.salesByCashier
    ? Object.entries(salesReports.salesByCashier).map(([cashier, d]) => ({
        cashier,
        sales: d.sales || 0,
        transactions: d.transactions || 0,
      }))
    : []

  const totalSales = Number(salesReports?.totalRevenue || salesReports?.totalSales || 0)
  const totalTransactions = Number(salesReports?.totalTransactions || 0)
  const avgTicket = Number(salesReports?.averageTicket || 0)
  const cashSales = Number(salesReports?.cashSales || 0)
  const cardSales = Number(salesReports?.cardSales || 0)
  const discounts = Number(salesReports?.discounts || 0)
  const taxCollected = Number(salesReports?.taxCollected || 0)

  // Expenses from financial reports
  const totalExpenses = Number(financialReports?.totalExpenses || 0)
  const netProfit = totalSales - totalExpenses
  const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0

  // Expense breakdown from financial reports
  const expenseBreakdown = Array.isArray(financialReports?.expenseBreakdown)
    ? financialReports.expenseBreakdown
    : []

  // Payment method data for pie chart
  const paymentMethodData = [
    { name: 'Cash', value: cashSales, color: '#1976d2' },
    { name: 'Card', value: cardSales, color: '#42a5f5' },
    { name: 'Credit', value: Number(salesReports?.creditSales || 0), color: '#1565c0' },
  ].filter((p) => p.value > 0)

  // Revenue vs expenses chart data
  const revenueData = Array.isArray(financialReports?.revenueByPeriod)
    ? financialReports.revenueByPeriod
    : []

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows = [
      ['Sales Report', `${toDateStr(filters.dateFrom)} to ${toDateStr(filters.dateTo)}`],
      [],
      ['Summary'],
      ['Total Sales', totalSales],
      ['Total Expenses', totalExpenses],
      ['Net Profit', netProfit],
      ['Profit Margin', `${profitMargin.toFixed(1)}%`],
      ['Total Transactions', totalTransactions],
      ['Avg Ticket', avgTicket.toFixed(2)],
      ['Cash Sales', cashSales],
      ['Card Sales', cardSales],
      ['Discounts', discounts],
      ['Tax Collected', taxCollected],
      [],
      ['Expense Breakdown'],
      ['Category', 'Amount', 'Percentage'],
      ...expenseBreakdown.map((e) => [e.category, e.amount, `${e.percentage}%`]),
      [],
      ['Daily Sales'],
      ['Date', 'Sales', 'Transactions'],
      ...salesData.map((r) => [r.date, r.sales, r.transactions]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `sales-report-${toDateStr(filters.dateFrom)}-to-${toDateStr(filters.dateTo)}.csv`
    a.click()
    setExportAnchor(null)
  }

  const handleExportPDF = () => {
    const w = window.open('', '_blank')
    w.document.write(`
      <html><head><title>Sales Report</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#333}
        h1{color:#1976d2;border-bottom:2px solid #1976d2;pb:10px}
        h3{color:#1565c0;margin-top:25px}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin:20px 0}
        .card{border:1px solid #e0e0e0;border-radius:8px;padding:15px;text-align:center}
        .card-val{font-size:1.5rem;font-weight:700;color:#1976d2}
        .card-lbl{font-size:0.8rem;color:#666;text-transform:uppercase}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
        th{background:#e3f2fd;color:#1565c0;font-weight:600}
        tr:nth-child(even){background:#f5f5f5}
        .profit-pos{color:#2e7d32} .profit-neg{color:#c62828}
      </style></head><body>
      <h1>Sales Report</h1>
      <p><strong>Period:</strong> ${toDateStr(filters.dateFrom)} to ${toDateStr(filters.dateTo)}</p>
      <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

      <div class="grid">
        <div class="card"><div class="card-val">PKR ${fmt(totalSales)}</div><div class="card-lbl">Total Sales</div></div>
        <div class="card"><div class="card-val ${netProfit >= 0 ? 'profit-pos' : 'profit-neg'}">PKR ${fmt(netProfit)}</div><div class="card-lbl">Net Profit</div></div>
        <div class="card"><div class="card-val">PKR ${fmt(totalExpenses)}</div><div class="card-lbl">Total Expenses</div></div>
        <div class="card"><div class="card-val">${profitMargin.toFixed(1)}%</div><div class="card-lbl">Profit Margin</div></div>
      </div>

      <h3>Payment Methods</h3>
      <table><tr><th>Method</th><th>Amount</th></tr>
        <tr><td>Cash</td><td>PKR ${fmt(cashSales)}</td></tr>
        <tr><td>Card</td><td>PKR ${fmt(cardSales)}</td></tr>
        <tr><td>Discounts</td><td>-PKR ${fmt(discounts)}</td></tr>
        <tr><td>Tax Collected</td><td>PKR ${fmt(taxCollected)}</td></tr>
      </table>

      <h3>Expense Breakdown</h3>
      <table><tr><th>Category</th><th>Amount</th><th>%</th></tr>
        ${expenseBreakdown.map((e) => `<tr><td>${e.category}</td><td>PKR ${fmt(e.amount)}</td><td>${e.percentage}%</td></tr>`).join('')}
      </table>

      <h3>Daily Sales</h3>
      <table><tr><th>Date</th><th>Sales</th><th>Transactions</th></tr>
        ${salesData.map((r) => `<tr><td>${r.date}</td><td>PKR ${fmt(r.sales)}</td><td>${r.transactions}</td></tr>`).join('')}
      </table>
      </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 400)
    setExportAnchor(null)
  }

  const loading = isLoading || financialLoading

  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'grey.50', minHeight: '100vh' }}>

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 3,
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}
              >
                Reports / Sales
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mt: 0.5, letterSpacing: '-0.5px' }}>
                Sales Report
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Revenue, profit, expenses &amp; payment breakdown
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                onClick={loadAll}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
                variant="outlined"
                size="small"
              >
                {loading ? 'Loading…' : 'Refresh'}
              </Button>
              <Button
                onClick={(e) => setExportAnchor(e.currentTarget)}
                startIcon={<Download />}
                variant="contained"
                size="small"
              >
                Export
              </Button>
              <Menu
                anchorEl={exportAnchor}
                open={Boolean(exportAnchor)}
                onClose={() => setExportAnchor(null)}
              >
                <MenuItem onClick={handleExportCSV}>Export CSV</MenuItem>
                <MenuItem onClick={handleExportPDF}>Export PDF</MenuItem>
              </Menu>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
              {error}
            </Alert>
          )}

          {/* ── Time Preset Chips ───────────────────────────────────────────── */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mr: 1 }}>
                Period:
              </Typography>
              {Object.entries(PRESETS).map(([key, p]) => (
                <Chip
                  key={key}
                  label={p.label}
                  size="small"
                  onClick={() => applyPreset(key)}
                  color={activePreset === key ? 'primary' : 'default'}
                  variant={activePreset === key ? 'filled' : 'outlined'}
                  sx={{ fontWeight: activePreset === key ? 700 : 400 }}
                />
              ))}
            </Box>
          </Paper>

          {/* ── Filters ─────────────────────────────────────────────────────── */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <FilterList sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>Filters</Typography>
            </Box>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  enableAccessibleFieldDOMStructure={false}
                  label="From Date"
                  value={filters.dateFrom}
                  onChange={(d) => {
                    setActivePreset('custom')
                    setFilters((p) => ({ ...p, dateFrom: d }))
                  }}
                  slots={{ textField: TextField }}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  enableAccessibleFieldDOMStructure={false}
                  label="To Date"
                  value={filters.dateTo}
                  onChange={(d) => {
                    setActivePreset('custom')
                    setFilters((p) => ({ ...p, dateTo: d }))
                  }}
                  slots={{ textField: TextField }}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              {user?.role === 'ADMIN' && (
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Branch / Scope</InputLabel>
                    <Select
                      value={filters.branch}
                      onChange={(e) => setFilters((p) => ({ ...p, branch: e.target.value }))}
                      label="Branch / Scope"
                    >
                      <MenuItem value="all">All Branches</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={6} md={3}>
                <Button variant="contained" fullWidth onClick={loadAll} disabled={loading}>
                  Apply Filters
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* ── KPI Cards ───────────────────────────────────────────────────── */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                label="Total Sales"
                value={fmtPKR(totalSales)}
                sub={`${fmt(totalTransactions)} transactions`}
                accent="#1976d2"
                icon={<AttachMoney />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                label="Net Profit"
                value={fmtPKR(netProfit)}
                sub={`${profitMargin.toFixed(1)}% margin`}
                accent={netProfit >= 0 ? '#2e7d32' : '#c62828'}
                icon={<TrendingUp />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                label="Total Expenses"
                value={fmtPKR(totalExpenses)}
                sub="From financial vouchers"
                accent="#ed6c02"
                icon={<Receipt />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                label="Avg. Ticket"
                value={fmtPKR(avgTicket)}
                sub={`Tax collected: ${fmtPKR(taxCollected)}`}
                accent="#7b1fa2"
                icon={<Assessment />}
              />
            </Grid>
          </Grid>

          {/* ── Revenue vs Expenses + Payment Methods ──────────────────────── */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {/* Sales Trend */}
            <Grid item xs={12} md={8}>
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5 }}>
                <SectionHeader title="Daily Sales Trend" icon={<BarIcon />} />
                {salesData.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: 'text.disabled' }}>
                    <Typography>No sales data for selected period</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={270}>
                    <LineChart data={salesData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fill: '#9e9e9e', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9e9e9e', fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`PKR ${fmt(v)}`, 'Sales']} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      <Line
                        name="Sales"
                        type="monotone"
                        dataKey="sales"
                        stroke="#1976d2"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>

            {/* Payment Methods */}
            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, height: '100%' }}
              >
                <SectionHeader title="Payment Methods" icon={<PieIcon />} />

                {paymentMethodData.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'text.disabled' }}>
                    <Typography>No data</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={paymentMethodData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        dataKey="value"
                        paddingAngle={3}
                        labelLine={false}
                      >
                        {paymentMethodData.map((e, i) => (
                          <Cell key={i} fill={e.color || PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`PKR ${fmt(v)}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}

                <Divider sx={{ my: 1.5 }} />

                {/* Payment breakdown list */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {[
                    { label: 'Cash', value: cashSales, color: '#1976d2' },
                    { label: 'Card', value: cardSales, color: '#42a5f5' },
                    { label: 'Discounts', value: -discounts, color: '#ed6c02', negative: true },
                    { label: 'Tax Collected', value: taxCollected, color: '#2e7d32' },
                  ].map((item) => (
                    <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
                        <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, color: item.negative ? 'error.main' : 'text.primary' }}
                      >
                        {item.negative ? '-' : ''}PKR {fmt(Math.abs(item.value))}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* ── Revenue vs Expenses Trend + Expense Breakdown ───────────────── */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} md={7}>
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5 }}>
                <SectionHeader title="Revenue vs Expenses" icon={<TrendingUp />} />
                {revenueData.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, color: 'text.disabled' }}>
                    <Typography>No monthly data available</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={revenueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: '#9e9e9e', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9e9e9e', fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`PKR ${fmt(v)}`, '']} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      <Bar name="Revenue" dataKey="revenue" fill="#1976d2" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar name="Expenses" dataKey="expenses" fill="#ef5350" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar name="Profit" dataKey="profit" fill="#2e7d32" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>

            {/* Expense Breakdown from Financial Vouchers */}
            <Grid item xs={12} md={5}>
              <Paper
                elevation={0}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, height: '100%' }}
              >
                <SectionHeader title="Expense Breakdown" icon={<Receipt />} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  From approved financial vouchers
                </Typography>

                {expenseBreakdown.length === 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 1 }}>
                    <Receipt sx={{ fontSize: 40, color: 'text.disabled' }} />
                    <Typography color="text.disabled" variant="body2">No expense vouchers in this period</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {expenseBreakdown.slice(0, 8).map((item, i) => (
                      <Box
                        key={i}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          py: 1.2,
                          borderBottom: i < expenseBreakdown.length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider',
                        }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: PIE_COLORS[i % PIE_COLORS.length],
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary', fontSize: '0.82rem' }}>
                          {item.category}
                        </Typography>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.82rem' }}>
                            PKR {fmt(item.amount)}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {item.percentage}%
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        pt: 1.5,
                        mt: 0.5,
                        borderTop: '2px solid',
                        borderColor: 'primary.main',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Total Expenses</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>
                        PKR {fmt(totalExpenses)}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* ── Profit Summary Banner ────────────────────────────────────────── */}
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: netProfit >= 0 ? 'success.light' : 'error.light',
              bgcolor: netProfit >= 0 ? 'success.50' : 'error.50',
              borderRadius: 2,
              p: 2.5,
              mb: 3,
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      bgcolor: netProfit >= 0 ? 'success.main' : 'error.main',
                      borderRadius: '50%',
                      p: 1.5,
                      display: 'flex',
                    }}
                  >
                    {netProfit >= 0 ? (
                      <TrendingUp sx={{ color: '#fff', fontSize: 28 }} />
                    ) : (
                      <TrendingDown sx={{ color: '#fff', fontSize: 28 }} />
                    )}
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                      Net Profit / Loss
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: netProfit >= 0 ? 'success.dark' : 'error.dark' }}>
                      {netProfit < 0 ? '-' : ''}PKR {fmt(Math.abs(netProfit))}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {profitMargin.toFixed(1)}% profit margin on PKR {fmt(totalSales)} revenue
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Grid container spacing={2}>
                  {[
                    { label: 'Revenue', value: fmtPKR(totalSales), color: 'primary.main' },
                    { label: 'Cost / Expenses', value: fmtPKR(totalExpenses), color: 'error.main' },
                    { label: 'Transactions', value: fmt(totalTransactions), color: 'text.primary' },
                    { label: 'Avg. Ticket', value: fmtPKR(avgTicket), color: 'text.primary' },
                  ].map((item) => (
                    <Grid item xs={6} key={item.label}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: item.color }}>{item.value}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </Paper>

          {/* ── Cashier Table + Recent Sales ────────────────────────────────── */}
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={5}>
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5 }}>
                <SectionHeader title="Sales by Cashier" icon={<Person />} />
                <TableContainer sx={{ maxHeight: 340 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Cashier', 'Sales (PKR)', 'Txns'].map((h) => (
                          <TableCell
                            key={h}
                            align={h !== 'Cashier' ? 'right' : 'left'}
                            sx={{
                              bgcolor: 'primary.50',
                              color: 'primary.dark',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                            }}
                          >
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cashierData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.disabled' }}>
                            No data
                          </TableCell>
                        </TableRow>
                      ) : (
                        cashierData.map((row, i) => (
                          <TableRow
                            key={i}
                            sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                          >
                            <TableCell sx={{ fontSize: '0.82rem' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    bgcolor: 'primary.100',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: 'primary.dark',
                                  }}
                                >
                                  {(row.cashier || '?').charAt(0).toUpperCase()}
                                </Box>
                                {row.cashier}
                              </Box>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '0.82rem' }}>
                              {fmt(row.sales)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                              {row.transactions}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            <Grid item xs={12} md={7}>
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5 }}>
                <SectionHeader title="Recent Transactions" icon={<ShoppingCart />} />
                <TableContainer sx={{ maxHeight: 340 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Date', 'Customer', 'Amount', 'Method', 'Status'].map((h) => (
                          <TableCell
                            key={h}
                            sx={{
                              bgcolor: 'primary.50',
                              color: 'primary.dark',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                            }}
                          >
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentSales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.disabled' }}>
                            No recent transactions
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentSales.slice(0, 10).map((row, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                            <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                              {row.date
                                ? new Date(row.date || row.created_at).toLocaleDateString()
                                : row.created_at
                                ? new Date(row.created_at).toLocaleDateString()
                                : '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.82rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.customer_name || row.cashier || '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'primary.main', whiteSpace: 'nowrap' }}>
                              PKR {fmt(row.sales || row.total_amount || 0)}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.78rem' }}>
                              <Chip
                                label={row.payment_method || 'Cash'}
                                size="small"
                                sx={{ fontSize: '0.68rem', height: 20 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label="Completed"
                                size="small"
                                color="success"
                                sx={{ fontSize: '0.68rem', height: 20 }}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
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