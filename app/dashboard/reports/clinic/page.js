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
const toStr = (d) => { if (!d) return null; if (d instanceof Date) return d.toISOString().split('T')[0]; return d }
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
    background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, color: '#333',
    fontSize: 13, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '10px 14px',
  },
  labelStyle: { fontWeight: 700, marginBottom: 4 },
}

const yFmt = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return v
}

function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <Card elevation={0} sx={{
      border: '1px solid #f0f0f0',
      borderTop: `3px solid ${accent}`,
      borderRadius: 2.5,
      height: '100%',
      bgcolor: '#fff',
    }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1,
              fontWeight: 700, fontSize: '.65rem', display: 'block', mb: 0.8,
            }}>
              {label}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1.45rem', color: 'text.primary', lineHeight: 1.15, mb: 0.4 }}>
              {value}
            </Typography>
            {sub && (
              <Typography sx={{ color: 'text.secondary', fontSize: '.75rem', display: 'block', mt: 0.3, lineHeight: 1.4 }}>
                {sub}
              </Typography>
            )}
          </Box>
          <Box sx={{ bgcolor: `${accent}14`, borderRadius: 2, p: 1.2, display: 'flex', flexShrink: 0, ml: 1.5 }}>
            <Box sx={{ color: accent, display: 'flex', fontSize: 20 }}>{icon}</Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function SectionTitle({ title, icon }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2.5 }}>
      <Box sx={{ color: 'primary.main', display: 'flex', fontSize: 20 }}>{icon}</Box>
      <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>{title}</Typography>
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
    .filter((c) => c.revenue > 0)
    .map((c, i) => ({
      name: c.category,
      value: c.revenue,
      color: CAT_COLORS[i % CAT_COLORS.length],
    }))

  const dateChart = byDate.map((d) => ({
    date: d.date?.slice(5) || '',
    revenue: Number(d.revenue || 0),
    quantity: Number(d.quantity || 0),
  }))

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
                Clinic service revenue only · Product sales are on Sales Report
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

        <Box sx={{ px: { xs: 2, md: 4 }, py: 3, width: '100%', boxSizing: 'border-box' }}>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }} columns={12}>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Clinic Revenue" value={fmtPKR(totalRevenue)} sub={`${fmt(totalInvoices)} invoices`} accent="#0288d1" icon={<AttachMoney />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Services Sold" value={fmt(totalQuantity)} sub={`${fmt(totalLines)} line items`} accent="#2e7d32" icon={<MedicalServices />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Categories" value={fmt(byCategory.length)} sub={filters.category === 'all' ? 'In selected period' : 'Filtered'} accent="#6a1b9a" icon={<Category />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Avg / Invoice" value={fmtPKR(averageTicket)} sub="Clinic portion only" accent="#e65100" icon={<ShoppingCart />} />
            </Grid>
          </Grid>

          <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2.5, p: 3.5, mb: 3, bgcolor: '#fff' }}>
            <SectionTitle title="Daily Clinic Revenue" icon={<Assessment />} />
            {dateChart.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'text.disabled' }}>
                <Typography>No clinic sales in selected period</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dateChart} margin={{ top: 10, right: 24, left: 0, bottom: dateChart.length > 15 ? 40 : 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#aaa', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#ececec' }}
                    interval={dateChart.length > 25 ? Math.ceil(dateChart.length / 12) : dateChart.length > 15 ? 1 : 0}
                    angle={dateChart.length > 15 ? -40 : 0}
                    textAnchor={dateChart.length > 15 ? 'end' : 'middle'}
                    height={dateChart.length > 15 ? 52 : 28}
                  />
                  <YAxis tick={{ fill: '#aaa', fontSize: 12 }} tickFormatter={yFmt} width={62} tickLine={false} axisLine={false} />
                  <Tooltip {...TT} formatter={(v) => [`PKR ${fmt(v)}`, 'Revenue']} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar name="Revenue" dataKey="revenue" fill="#0288d1" radius={[5, 5, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={5}>
              <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2.5, p: 3, bgcolor: '#fff', height: '100%' }}>
                <SectionTitle title="By Category" icon={<Category />} />
                {pieCats.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: 'text.disabled' }}>
                    <Typography>No data</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={pieCats} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value" paddingAngle={3}>
                        {pieCats.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip {...TT} formatter={(v) => [`PKR ${fmt(v)}`, '']} />
                      <Legend iconSize={11} wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <Box sx={{ mt: 1 }}>
                  {byCategory.map((c, i) => {
                    const pct = totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(1) : '0.0'
                    const color = CAT_COLORS[i % CAT_COLORS.length]
                    return (
                      <Box key={c.categoryId ?? c.category} sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                          <Typography sx={{ fontSize: '.8rem', fontWeight: 600 }}>{c.category}</Typography>
                          <Typography sx={{ fontSize: '.8rem', fontWeight: 700, color }}>{fmtPKR(c.revenue)}</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(parseFloat(pct), 100)}
                          sx={{
                            height: 5, borderRadius: 3, bgcolor: '#ececec',
                            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                          }}
                        />
                      </Box>
                    )
                  })}
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={7}>
              <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2.5, p: 3, bgcolor: '#fff', height: '100%' }}>
                <SectionTitle title="Top Services" icon={<MedicalServices />} />
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Service</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Revenue</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {byService.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ color: 'text.disabled', py: 4 }}>
                            No clinic services sold in this period
                          </TableCell>
                        </TableRow>
                      ) : byService.slice(0, 15).map((s) => (
                        <TableRow key={`${s.clinicServiceId}-${s.name}`} hover>
                          <TableCell>
                            <Typography sx={{ fontWeight: 600, fontSize: '.85rem' }}>{s.name}</Typography>
                            {s.code && <Typography variant="caption" color="text.disabled">{s.code}</Typography>}
                          </TableCell>
                          <TableCell>
                            <Chip label={s.category} size="small" sx={{ height: 20, fontSize: '.65rem', borderRadius: 1 }} />
                          </TableCell>
                          <TableCell align="right">{fmt(s.quantity)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtPKR(s.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>

          <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2.5, p: 3, bgcolor: '#fff' }}>
            <SectionTitle title="Recent Clinic Line Items" icon={<Receipt />} />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Invoice</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Service</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Branch</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentLines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ color: 'text.disabled', py: 4 }}>
                        No clinic line items
                      </TableCell>
                    </TableRow>
                  ) : recentLines.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.invoiceNo}</TableCell>
                      <TableCell>{r.customerName}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.serviceName}</TableCell>
                      <TableCell>
                        <Chip label={r.category} size="small" sx={{ height: 20, fontSize: '.65rem', borderRadius: 1 }} />
                      </TableCell>
                      <TableCell align="right">{fmt(r.quantity)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtPKR(r.total)}</TableCell>
                      <TableCell>{r.branch}</TableCell>
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
