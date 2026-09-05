'use client'

import AppDatePicker from '../../../../components/date/AppDatePicker'
import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Menu, CircularProgress, LinearProgress,
} from '@mui/material'
import {
  Refresh, Download, AttachMoney, Receipt, Assessment, CalendarToday,
  MedicalServices, Category, ShoppingCart,
} from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import {
  BarChart, Bar, PieChart, Pie, Cell, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { fetchClinicSalesReports } from '../../../store/slices/reportsSlice'
import RouteGuard from '../../../../components/auth/RouteGuard'

const fmt = (v, d = 0) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtPKR = (v) => `PKR ${fmt(v)}`
// Use LOCAL date components so Pakistan midnight doesn't shift to the previous UTC day
const toStr = (d) => {
  if (!d) return null
  if (d instanceof Date) {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return d
}
const today = () => new Date()
const som = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d }
const ago = (n) => new Date(Date.now() - n * 86400000)

const PRESETS = {
  today: { label: 'Today', from: today, to: today },
  this_month: { label: 'This Month', from: som, to: today },
  last_7: { label: 'Last 7 Days', from: () => ago(7), to: today },
  last_30: { label: 'Last 30 Days', from: () => ago(30), to: today },
  last_90: { label: '3 Months', from: () => ago(90), to: today },
  custom: { label: 'Custom', from: null, to: null },
}

const CAT_COLORS = ['#0288d1', '#2e7d32', '#e65100', '#6a1b9a', '#c62828', '#00838f', '#f9a825', '#455a64']

const TT = {
  contentStyle: {
    background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, color: '#333',
    fontSize: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '12px 16px',
  },
  labelStyle: { fontWeight: 700, marginBottom: 6, fontSize: 14 },
}

const yFmt = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return v
}

function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <Card elevation={0} sx={{
      border: '1px solid #eceff1',
      borderTop: `4px solid ${accent}`,
      borderRadius: 3,
      height: '100%',
      bgcolor: '#fff',
    }}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1.2,
              fontWeight: 700, fontSize: '.72rem', display: 'block', mb: 1,
            }}>
              {label}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.55rem', md: '1.85rem' }, color: 'text.primary', lineHeight: 1.1, mb: 0.6 }}>
              {value}
            </Typography>
            {sub && (
              <Typography sx={{ color: 'text.secondary', fontSize: '.85rem', display: 'block', mt: 0.4, lineHeight: 1.45 }}>
                {sub}
              </Typography>
            )}
          </Box>
          <Box sx={{ bgcolor: `${accent}16`, borderRadius: 2.5, p: 1.6, display: 'flex', flexShrink: 0, ml: 1.5 }}>
            <Box sx={{ color: accent, display: 'flex', fontSize: 26 }}>{icon}</Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function SectionTitle({ title, icon }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3.5 }}>
      <Box sx={{ color: 'primary.main', display: 'flex', fontSize: 28 }}>{icon}</Box>
      <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.2rem', md: '1.35rem' }, color: 'text.primary', letterSpacing: '-.3px' }}>{title}</Typography>
    </Box>
  )
}

export default function ClinicSalesReportPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((s) => s.auth)
  const { clinicSalesReports, isLoading } = useSelector((s) => s.reports)
  const [exportAnchor, setExportAnchor] = useState(null)
  const [activePreset, setActivePreset] = useState('this_month')
  const [filters, setFilters] = useState({
    dateFrom: som(),
    dateTo: today(),
    branch: 'all',
    category: 'all',
  })

  const buildParams = useCallback(() => ({
    dateRange: { start: toStr(filters.dateFrom), end: toStr(filters.dateTo) },
    ...(filters.branch !== 'all' && { branch: filters.branch }),
    ...(filters.category !== 'all' && { category: filters.category }),
  }), [filters])

  const loadAll = useCallback(() => {
    dispatch(fetchClinicSalesReports(buildParams()))
  }, [dispatch, buildParams])

  useEffect(() => { loadAll() }, [loadAll])

  const applyPreset = (key) => {
    if (key === 'custom') { setActivePreset('custom'); return }
    const p = PRESETS[key]
    setActivePreset(key)
    setFilters((prev) => ({ ...prev, dateFrom: p.from(), dateTo: p.to() }))
  }

  const cr = clinicSalesReports || {}
  const totalRevenue = Number(cr.totalRevenue || 0)
  const totalQuantity = Number(cr.totalQuantity || 0)
  const totalLines = Number(cr.totalLines || 0)
  const totalInvoices = Number(cr.totalInvoices || 0)
  const averageTicket = Number(cr.averageTicket || 0)
  const byCategory = Array.isArray(cr.byCategory) ? cr.byCategory : []
  const byService = Array.isArray(cr.byService) ? cr.byService : []
  const byDate = Array.isArray(cr.byDate) ? cr.byDate : []
  const byBranch = Array.isArray(cr.byBranch) ? cr.byBranch : []
  const recentLines = Array.isArray(cr.recentLines) ? cr.recentLines : []
  const categories = Array.isArray(cr.categories) ? cr.categories : []
  const periodStr = `${toStr(filters.dateFrom) || '—'} to ${toStr(filters.dateTo) || '—'}`

  const pieCats = byCategory
    .filter((c) => Number(c.revenue || 0) > 0)
    .map((c, i) => ({
      name: c.category,
      value: c.revenue,
      color: CAT_COLORS[i % CAT_COLORS.length],
    }))

  const categoriesWithRevenue = byCategory.filter((c) => Number(c.revenue || 0) > 0)
  const topServices = byService.filter((s) => Number(s.revenue || 0) > 0)

  const dateChart = byDate.map((d) => ({
    date: d.date?.slice(5) || '',
    fullDate: d.date || '',
    revenue: Number(d.revenue || 0),
    quantity: Number(d.quantity || 0),
  }))

  // Few days → horizontal bars so the chart fills the page width (no tiny centered column)
  const useHorizontalBars = dateChart.length > 0 && dateChart.length <= 8
  const barChartHeight = useHorizontalBars
    ? Math.max(280, dateChart.length * 72 + 80)
    : 460
  const barCategoryGap = dateChart.length <= 3 ? '18%' : dateChart.length <= 8 ? '22%' : '16%'
  const barMaxSize = useHorizontalBars ? 42 : (dateChart.length <= 5 ? 88 : 64)

  const handleExportCSV = () => {
    const rows = [
      ['Clinic Sales Report', periodStr],
      ['Category filter', filters.category === 'all' ? 'All' : filters.category],
      [],
      ['Total Revenue', totalRevenue],
      ['Services Sold (qty)', totalQuantity],
      ['Line Items', totalLines],
      ['Invoices', totalInvoices],
      [],
      ['Category', 'Revenue', 'Qty', 'Lines'],
      ...byCategory.map((r) => [r.category, r.revenue, r.quantity, r.lines]),
      [],
      ['Service', 'Category', 'Revenue', 'Qty'],
      ...byService.map((r) => [r.name, r.category, r.revenue, r.quantity]),
      [],
      ['Date', 'Invoice', 'Customer', 'Service', 'Category', 'Qty', 'Total', 'Branch'],
      ...recentLines.map((r) => [
        r.date, r.invoiceNo, r.customerName, r.serviceName, r.category, r.quantity, r.total, r.branch,
      ]),
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `clinic-sales-${toStr(filters.dateFrom)}-${toStr(filters.dateTo)}.csv`
    a.click()
    setExportAnchor(null)
  }

  const handleExportPDF = () => {
    const w = window.open('', '_blank')
    if (!w) return
    const catFilter = filters.category === 'all' ? 'All categories' : filters.category
    w.document.write(`<html><head><title>Clinic Sales Report</title><style>
      body{font-family:Arial;padding:32px;color:#333;font-size:13px}
      h1{color:#0288d1;border-bottom:2px solid #0288d1;padding-bottom:8px}
      h2{color:#0277bd;margin-top:20px;font-size:14px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
      th,td{border:1px solid #e0e0e0;padding:7px 10px}
      th{background:#e1f5fe;font-weight:700}
      tr:nth-child(even){background:#fafafa}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}
      .card{border:1px solid #e0e0e0;border-radius:8px;padding:14px;text-align:center;background:#f5fbff}
      .val{font-size:1.1rem;font-weight:800;color:#0288d1}
      .lbl{font-size:.7rem;color:#888;text-transform:uppercase}
    </style></head><body>
      <h1>Clinic Sales Report — ${periodStr}</h1>
      <p style="color:#666;margin-top:-4px">Filter: ${catFilter} · Clinic services only</p>
      <div class="grid">
        <div class="card"><div class="val">PKR ${fmt(totalRevenue)}</div><div class="lbl">Clinic Revenue</div></div>
        <div class="card"><div class="val" style="color:#2e7d32">${fmt(totalQuantity)}</div><div class="lbl">Services Sold</div></div>
        <div class="card"><div class="val">${fmt(totalInvoices)}</div><div class="lbl">Invoices</div></div>
        <div class="card"><div class="val" style="color:#e65100">PKR ${fmt(averageTicket)}</div><div class="lbl">Avg / Invoice</div></div>
      </div>
      <h2>By Category</h2>
      <table><tr><th>Category</th><th>Revenue</th><th>Qty</th><th>Lines</th></tr>
      ${byCategory.map((c) => `<tr><td>${c.category || ''}</td><td>PKR ${fmt(c.revenue)}</td><td>${fmt(c.quantity)}</td><td>${fmt(c.lines)}</td></tr>`).join('') || '<tr><td colspan="4">No data</td></tr>'}
      </table>
      <h2>Top Services</h2>
      <table><tr><th>Service</th><th>Category</th><th>Qty</th><th>Revenue</th></tr>
      ${byService.slice(0, 25).map((s) => `<tr><td>${s.name || ''}</td><td>${s.category || ''}</td><td>${fmt(s.quantity)}</td><td>PKR ${fmt(s.revenue)}</td></tr>`).join('') || '<tr><td colspan="4">No data</td></tr>'}
      </table>
      <h2>Recent Clinic Line Items</h2>
      <table><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Service</th><th>Category</th><th>Qty</th><th>Total</th><th>Branch</th></tr>
      ${recentLines.slice(0, 40).map((r) => `<tr><td>${r.date || ''}</td><td>${r.invoiceNo || ''}</td><td>${r.customerName || ''}</td><td>${r.serviceName || ''}</td><td>${r.category || ''}</td><td>${fmt(r.quantity)}</td><td>PKR ${fmt(r.total)}</td><td>${r.branch || ''}</td></tr>`).join('') || '<tr><td colspan="8">No data</td></tr>'}
      </table>
    </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 400)
    setExportAnchor(null)
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
      <Box sx={{ bgcolor: '#f7f8fa', minHeight: '100vh', width: '100%' }}>
        <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid #f0f0f0', px: { xs: 2, md: 4 }, pt: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, fontSize: '.65rem' }}>
                Reports / Clinic
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.4, letterSpacing: '-.5px' }}>
                Clinic Sales Report
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                Clinic service revenue only · Mixed bills keep full invoice in Sales; inventory portion stays on Sales Report
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                onClick={loadAll}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={14} /> : <Refresh />}
                variant="outlined"
                size="small"
                sx={{ borderRadius: 2 }}
              >
                {isLoading ? 'Loading…' : 'Refresh'}
              </Button>
              <Button
                onClick={(e) => setExportAnchor(e.currentTarget)}
                startIcon={<Download />}
                variant="contained"
                size="small"
                sx={{ borderRadius: 2 }}
              >
                Export
              </Button>
              <Menu
                anchorEl={exportAnchor}
                open={Boolean(exportAnchor)}
                onClose={() => setExportAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{ elevation: 3, sx: { borderRadius: 2, minWidth: 160, mt: 0.5 } }}
              >
                <MenuItem onClick={handleExportCSV}>Export CSV</MenuItem>
                <MenuItem onClick={handleExportPDF}>Export PDF</MenuItem>
              </Menu>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap', mb: 2 }}>
            <CalendarToday sx={{ fontSize: 14, color: 'text.disabled' }} />
            {Object.entries(PRESETS).map(([key, p]) => (
              <Chip
                key={key}
                label={p.label}
                size="small"
                onClick={() => applyPreset(key)}
                color={activePreset === key ? 'primary' : 'default'}
                variant={activePreset === key ? 'filled' : 'outlined'}
                sx={{ fontWeight: activePreset === key ? 700 : 500, borderRadius: 1.5, fontSize: '.72rem' }}
              />
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <AppDatePicker
                enableAccessibleFieldDOMStructure={false}
                label="From Date"
                value={filters.dateFrom}
                onChange={(d) => { setActivePreset('custom'); setFilters((p) => ({ ...p, dateFrom: d })) }}
                slots={{ textField: TextField }}
                slotProps={{ textField: { size: 'small', sx: { minWidth: 150 } } }}
              />
              <AppDatePicker
                enableAccessibleFieldDOMStructure={false}
                label="To Date"
                value={filters.dateTo}
                onChange={(d) => { setActivePreset('custom'); setFilters((p) => ({ ...p, dateTo: d })) }}
                slots={{ textField: TextField }}
                slotProps={{ textField: { size: 'small', sx: { minWidth: 150 } } }}
              />
            </LocalizationProvider>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Clinic Category</InputLabel>
              <Select
                value={filters.category}
                onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}
                label="Clinic Category"
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {user?.role === 'ADMIN' && (
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Branch</InputLabel>
                <Select
                  value={filters.branch}
                  onChange={(e) => setFilters((p) => ({ ...p, branch: e.target.value }))}
                  label="Branch"
                >
                  <MenuItem value="all">All Branches</MenuItem>
                  {byBranch.map((b) => (
                    <MenuItem key={b.branch} value={b.branch}>{b.branch}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Button variant="contained" onClick={loadAll} disabled={isLoading} sx={{ borderRadius: 2, px: 3 }}>
              Apply
            </Button>
          </Box>
        </Box>

        <Box sx={{ px: { xs: 2, md: 3, lg: 4 }, py: 3.5, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <Grid container spacing={2.5} sx={{ mb: 3.5 }} columns={12}>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Clinic Revenue" value={fmtPKR(totalRevenue)} sub={`${fmt(totalInvoices)} invoices`} accent="#0288d1" icon={<AttachMoney />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Services Sold" value={fmt(totalQuantity)} sub={`${fmt(totalLines)} line items`} accent="#2e7d32" icon={<MedicalServices />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Categories" value={fmt(categoriesWithRevenue.length)} sub={filters.category === 'all' ? 'With revenue in period' : 'Filtered'} accent="#6a1b9a" icon={<Category />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Avg / Invoice" value={fmtPKR(averageTicket)} sub="Clinic portion only" accent="#e65100" icon={<ShoppingCart />} />
            </Grid>
          </Grid>

          <Paper elevation={0} sx={{ border: '1px solid #eceff1', borderRadius: 3, p: { xs: 2.5, md: 4 }, mb: 3.5, bgcolor: '#fff', width: '100%' }}>
            <SectionTitle title="Daily Clinic Revenue" icon={<Assessment />} />
            {dateChart.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 360, color: 'text.disabled' }}>
                <Typography sx={{ fontSize: '1.1rem' }}>No clinic sales in selected period</Typography>
              </Box>
            ) : (
              <Box sx={{ width: '100%' }}>
                <ResponsiveContainer width="100%" height={barChartHeight}>
                  {useHorizontalBars ? (
                    <BarChart
                      layout="vertical"
                      data={dateChart}
                      margin={{ top: 8, right: 48, left: 16, bottom: 8 }}
                      barCategoryGap={barCategoryGap}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#eceff1" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: '#546e7a', fontSize: 15, fontWeight: 600 }}
                        tickFormatter={yFmt}
                        tickLine={false}
                        axisLine={{ stroke: '#e0e0e0' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="date"
                        width={72}
                        tick={{ fill: '#37474f', fontSize: 15, fontWeight: 700 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip {...TT} formatter={(v) => [`PKR ${fmt(v)}`, 'Revenue']} cursor={{ fill: 'rgba(2,136,209,0.06)' }} />
                      <Bar
                        name="Revenue"
                        dataKey="revenue"
                        fill="#0288d1"
                        radius={[0, 10, 10, 0]}
                        maxBarSize={barMaxSize}
                        label={{
                          position: 'right',
                          formatter: (v) => `PKR ${fmt(v)}`,
                          fill: '#455a64',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      />
                    </BarChart>
                  ) : (
                    <BarChart
                      data={dateChart}
                      margin={{ top: 20, right: 24, left: 8, bottom: dateChart.length > 15 ? 52 : 28 }}
                      barCategoryGap={barCategoryGap}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#eceff1" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#546e7a', fontSize: 14, fontWeight: 600 }}
                        tickLine={false}
                        axisLine={{ stroke: '#e0e0e0' }}
                        interval={dateChart.length > 25 ? Math.ceil(dateChart.length / 12) : dateChart.length > 15 ? 1 : 0}
                        angle={dateChart.length > 15 ? -35 : 0}
                        textAnchor={dateChart.length > 15 ? 'end' : 'middle'}
                        height={dateChart.length > 15 ? 56 : 36}
                      />
                      <YAxis
                        tick={{ fill: '#546e7a', fontSize: 14, fontWeight: 600 }}
                        tickFormatter={yFmt}
                        width={72}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip {...TT} formatter={(v) => [`PKR ${fmt(v)}`, 'Revenue']} cursor={{ fill: 'rgba(2,136,209,0.06)' }} />
                      <Bar name="Revenue" dataKey="revenue" fill="#0288d1" radius={[10, 10, 0, 0]} maxBarSize={barMaxSize} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>

          <Grid container spacing={3} sx={{ mb: 3.5 }}>
            <Grid item xs={12} lg={4}>
              <Paper elevation={0} sx={{ border: '1px solid #eceff1', borderRadius: 3, p: { xs: 2.5, md: 4 }, bgcolor: '#fff', height: '100%', minHeight: 480 }}>
                <SectionTitle title="By Category" icon={<Category />} />
                {pieCats.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, color: 'text.disabled' }}>
                    <Typography sx={{ fontSize: '1.05rem' }}>No data</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={340}>
                    <PieChart>
                      <Pie
                        data={pieCats}
                        cx="50%"
                        cy="46%"
                        innerRadius={88}
                        outerRadius={132}
                        dataKey="value"
                        paddingAngle={pieCats.length > 1 ? 3 : 0}
                        stroke="#fff"
                        strokeWidth={3}
                      >
                        {pieCats.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip {...TT} formatter={(v) => [`PKR ${fmt(v)}`, '']} />
                      <Legend iconSize={14} wrapperStyle={{ fontSize: 15, fontWeight: 600, paddingTop: 12 }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <Box sx={{ mt: 2.5 }}>
                  {categoriesWithRevenue.map((c, i) => {
                    const pct = totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(1) : '0.0'
                    const color = CAT_COLORS[i % CAT_COLORS.length]
                    return (
                      <Box key={c.categoryId ?? c.category} sx={{ mb: 2.2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
                          <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>{c.category}</Typography>
                          <Typography sx={{ fontSize: '1rem', fontWeight: 800, color }}>{fmtPKR(c.revenue)} · {pct}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(parseFloat(pct), 100)}
                          sx={{
                            height: 10, borderRadius: 5, bgcolor: '#ececec',
                            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 5 },
                          }}
                        />
                      </Box>
                    )
                  })}
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} lg={8}>
              <Paper elevation={0} sx={{ border: '1px solid #eceff1', borderRadius: 3, p: { xs: 2.5, md: 4 }, bgcolor: '#fff', height: '100%', minHeight: 480 }}>
                <SectionTitle title="Top Services" icon={<MedicalServices />} />
                <TableContainer sx={{ width: '100%' }}>
                  <Table sx={{ tableLayout: 'fixed', width: '100%' }} size="medium">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, fontSize: '.9rem', width: '42%', py: 2, borderBottom: '2px solid #eceff1' }}>Service</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: '.9rem', width: '22%', py: 2, borderBottom: '2px solid #eceff1' }}>Category</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '.9rem', width: '14%', py: 2, borderBottom: '2px solid #eceff1' }}>Qty</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '.9rem', width: '22%', py: 2, borderBottom: '2px solid #eceff1' }}>Revenue</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topServices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ color: 'text.disabled', py: 8, fontSize: '1.05rem' }}>
                            No clinic services sold in this period
                          </TableCell>
                        </TableRow>
                      ) : topServices.slice(0, 20).map((s) => (
                        <TableRow key={`${s.clinicServiceId}-${s.name}`} hover>
                          <TableCell sx={{ py: 2.2 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{s.name}</Typography>
                            {s.code && <Typography sx={{ fontSize: '.8rem', color: 'text.disabled', mt: 0.3 }}>{s.code}</Typography>}
                          </TableCell>
                          <TableCell>
                            <Chip label={s.category} size="small" sx={{ height: 28, fontSize: '.8rem', fontWeight: 600, borderRadius: 1.5, px: 0.5 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>{fmt(s.quantity)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#0277bd' }}>{fmtPKR(s.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>

          <Paper elevation={0} sx={{ border: '1px solid #eceff1', borderRadius: 3, p: { xs: 2.5, md: 4 }, bgcolor: '#fff', width: '100%' }}>
            <SectionTitle title="Recent Clinic Line Items" icon={<Receipt />} />
            <TableContainer sx={{ width: '100%' }}>
              <Table sx={{ minWidth: 960, width: '100%' }} size="medium">
                <TableHead>
                  <TableRow>
                    {['Date', 'Invoice', 'Customer', 'Service', 'Category', 'Qty', 'Total', 'Branch'].map((h) => (
                      <TableCell
                        key={h}
                        align={h === 'Qty' || h === 'Total' ? 'right' : 'left'}
                        sx={{ fontWeight: 800, fontSize: '.85rem', py: 2, borderBottom: '2px solid #eceff1', whiteSpace: 'nowrap' }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentLines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ color: 'text.disabled', py: 6, fontSize: '1.05rem' }}>
                        No clinic line items
                      </TableCell>
                    </TableRow>
                  ) : recentLines.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontSize: '.95rem', py: 2, whiteSpace: 'nowrap' }}>{r.date}</TableCell>
                      <TableCell sx={{ fontSize: '.95rem', fontWeight: 700, color: 'primary.main', py: 2 }}>{r.invoiceNo}</TableCell>
                      <TableCell sx={{ fontSize: '.95rem', py: 2 }}>{r.customerName}</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '1rem', py: 2 }}>{r.serviceName}</TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Chip label={r.category} size="small" sx={{ height: 26, fontSize: '.78rem', fontWeight: 600, borderRadius: 1.5 }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '1rem', fontWeight: 600, py: 2 }}>{fmt(r.quantity)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: '1.05rem', py: 2 }}>{fmtPKR(r.total)}</TableCell>
                      <TableCell sx={{ fontSize: '.9rem', py: 2 }}>{r.branch}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Box>
    </RouteGuard>
  )
}
