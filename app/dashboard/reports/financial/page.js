'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  Alert, FormControl, InputLabel, Select, MenuItem, TextField,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, LinearProgress,
} from '@mui/material'
import {
  Refresh, Download, AttachMoney, TrendingUp, TrendingDown,
  Receipt, Assessment, FilterList, ArrowUpward, ArrowDownward,
} from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  BarChart, Bar, PieChart, Pie, Cell, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { fetchFinancialReports } from '../../../store/slices/reportsSlice'
import RouteGuard from '../../../../components/auth/RouteGuard'

const PIE_COLORS = ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
const fmt    = (v, d = 0) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtPKR = (v) => `PKR ${fmt(v)}`
const yFmt   = (v) => { if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`; if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`; return v }

const TT = {
  contentStyle: { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, color: '#333', fontSize: 13, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '10px 14px' },
  labelStyle: { fontWeight: 700, marginBottom: 4 },
}

function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <Card elevation={0} sx={{
      border: '1px solid #f0f0f0', borderTop: `3px solid ${accent}`,
      borderRadius: 2.5, height: '100%', bgcolor: '#fff',
      transition: 'all .2s',
      '&:hover': { boxShadow: '0 6px 24px rgba(0,0,0,0.09)', transform: 'translateY(-1px)' },
    }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, fontSize: '.65rem', display: 'block', mb: .8 }}>
              {label}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1.45rem', color: 'text.primary', lineHeight: 1.15, mb: .4 }}>
              {value}
            </Typography>
            {sub && <Typography sx={{ color: 'text.secondary', fontSize: '.75rem', display: 'block', mt: .3 }}>{sub}</Typography>}
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

export default function FinancialReportsPage() {
  const dispatch = useDispatch()

  // slice stores response.data.data directly — no unwrapping needed
  const { financialReports, isLoading, error } = useSelector((s) => s.reports)

  const [filters, setFilters] = useState({
    period:   'monthly',
    year:     new Date().getFullYear(),
    quarter:  'Q1',
    dateFrom: new Date(Date.now() - 365 * 86400000),
    dateTo:   new Date(),
  })

  useEffect(() => { dispatch(fetchFinancialReports(filters)) }, [dispatch, filters])

  const fr = financialReports || {}

  const totalRevenue      = Number(fr.totalRevenue      || 0)
  const totalCostOfGoods  = Number(fr.totalCostOfGoods  || 0)
  const grossProfit       = Number(fr.grossProfit       || 0)
  const grossProfitMargin = Number(fr.grossProfitMargin || 0)
  const totalExpenses     = Number(fr.totalExpenses     || 0)
  const netProfit         = Number(fr.netProfit         || 0)
  const netProfitMargin   = Number(fr.netProfitMargin   || fr.profitMargin || 0)
  const zakatDue          = Number(fr.zakatDue          || 0)
  const operatingCashFlow = Number(fr.operatingCashFlow || 0)

  const revenueData          = Array.isArray(fr.revenueByPeriod)      ? fr.revenueByPeriod      : []
  const cashFlowData         = Array.isArray(fr.cashFlowData)         ? fr.cashFlowData         : []
  const expenseBreakdown     = Array.isArray(fr.expenseBreakdown)     ? fr.expenseBreakdown     : []
  const profitabilityMetrics = Array.isArray(fr.profitabilityMetrics) ? fr.profitabilityMetrics : []
  const financialRatios      = Array.isArray(fr.financialRatios)      ? fr.financialRatios      : []
  const topRevenueSources    = Array.isArray(fr.topRevenueSources)    ? fr.topRevenueSources    : []

  const handleExportCSV = () => {
    const rows = [
      ['Financial Report'],
      ['Total Revenue',   totalRevenue],
      ['COGS',            totalCostOfGoods],
      ['Gross Profit',    grossProfit],
      ['Total Expenses',  totalExpenses],
      ['Net Profit',      netProfit],
      ['Profit Margin',   `${netProfitMargin.toFixed(1)}%`],
      ['Zakat Due',       zakatDue],
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ bgcolor: '#f7f8fa', minHeight: '100vh', width: '100%' }}>

          {/* ── Header bar (same style as SalesReportPage) ───────────────── */}
          <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid #f0f0f0', px: { xs: 2, md: 4 }, pt: 3, pb: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, fontSize: '.65rem' }}>
                  Reports / Financial
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: .4, letterSpacing: '-.5px' }}>
                  Financial Reports
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: .4 }}>
                  Revenue · COGS · Gross Profit · Net Profit · Zakat
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button onClick={() => dispatch(fetchFinancialReports(filters))} disabled={isLoading}
                  startIcon={<Refresh />} variant="outlined" size="small" sx={{ borderRadius: 2 }}>
                  {isLoading ? 'Loading…' : 'Refresh'}
                </Button>
                <Button onClick={handleExportCSV} startIcon={<Download />} variant="contained" size="small" sx={{ borderRadius: 2 }}>
                  Export CSV
                </Button>
              </Box>
            </Box>

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', pb: 1 }}>
              <FilterList sx={{ fontSize: 16, color: 'text.disabled' }} />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Period</InputLabel>
                <Select value={filters.period} onChange={(e) => setFilters(p => ({ ...p, period: e.target.value }))} label="Period">
                  {['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map(v =>
                    <MenuItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Year</InputLabel>
                <Select value={filters.year} onChange={(e) => setFilters(p => ({ ...p, year: e.target.value }))} label="Year">
                  {[2026, 2025, 2024, 2023, 2022].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
              <DatePicker enableAccessibleFieldDOMStructure={false} label="From Date" value={filters.dateFrom}
                onChange={(d) => setFilters(p => ({ ...p, dateFrom: d }))}
                slots={{ textField: TextField }}
                slotProps={{ textField: { size: 'small', sx: { minWidth: 150 } } }} />
              <DatePicker enableAccessibleFieldDOMStructure={false} label="To Date" value={filters.dateTo}
                onChange={(d) => setFilters(p => ({ ...p, dateTo: d }))}
                slots={{ textField: TextField }}
                slotProps={{ textField: { size: 'small', sx: { minWidth: 150 } } }} />
              <Button variant="contained" size="small" sx={{ borderRadius: 2, px: 3 }}
                onClick={() => dispatch(fetchFinancialReports(filters))}>
                Apply
              </Button>
            </Box>
          </Box>

          {/* ── Page content ─────────────────────────────────────────────── */}
          <Box sx={{ px: { xs: 2, md: 4 }, py: 3 }}>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* ── P&L Banner ───────────────────────────────────────────────── */}
            <Paper elevation={0} sx={{
              border: 'none', borderRadius: 2.5, p: { xs: 3, md: 4 }, mb: 3,
              background: netProfit >= 0
                ? 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 60%, #388e3c 100%)'
                : 'linear-gradient(135deg, #b71c1c 0%, #c62828 60%, #d32f2f 100%)',
              color: '#fff',
            }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                    <Box sx={{ bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2.5, p: 2, display: 'flex' }}>
                      {netProfit >= 0 ? <TrendingUp sx={{ fontSize: 32 }} /> : <TrendingDown sx={{ fontSize: 32 }} />}
                    </Box>
                    <Box>
                      <Typography sx={{ opacity: .8, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '.65rem', fontWeight: 700 }}>
                        Net {netProfit >= 0 ? 'Profit' : 'Loss'}{totalExpenses === 0 ? ' (Gross)' : ''}
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.1, mt: .3 }}>
                        {fmtPKR(Math.abs(netProfit))}
                      </Typography>
                      <Typography sx={{ opacity: .8, mt: .6, fontSize: '.82rem' }}>
                        {netProfitMargin.toFixed(1)}% net margin
                      </Typography>
                      {zakatDue > 0 && (
                        <Typography sx={{ color: '#ffd700', fontSize: '.8rem', fontWeight: 700, mt: .5 }}>
                          ☪ Zakat Due: {fmtPKR(zakatDue)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Grid container spacing={2}>
                    {[
                      { label: 'Revenue',      value: fmtPKR(totalRevenue) },
                      { label: 'COGS',         value: `− ${fmtPKR(totalCostOfGoods)}` },
                      { label: 'Gross Profit', value: fmtPKR(grossProfit) },
                      { label: 'Expenses',     value: `− ${fmtPKR(totalExpenses)}` },
                      { label: 'Cash Flow',    value: fmtPKR(operatingCashFlow) },
                      { label: 'Zakat Due',    value: fmtPKR(zakatDue) },
                    ].map(item => (
                      <Grid item xs={6} sm={4} key={item.label}>
                        <Typography sx={{ opacity: .7, fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: .8 }}>{item.label}</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem', mt: .2 }}>{item.value}</Typography>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              </Grid>
            </Paper>

            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard label="Total Revenue"      value={fmtPKR(totalRevenue)}
                  sub={`${grossProfitMargin.toFixed(1)}% gross margin`}
                  accent="#1976d2" icon={<AttachMoney />} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard label="Gross Profit"       value={fmtPKR(grossProfit)}
                  sub={`COGS: ${fmtPKR(totalCostOfGoods)}`}
                  accent="#10b981" icon={<TrendingUp />} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard label="Net Profit"         value={fmtPKR(netProfit)}
                  sub={`${netProfitMargin.toFixed(1)}% net margin · Expenses: ${fmtPKR(totalExpenses)}`}
                  accent={netProfit >= 0 ? '#2e7d32' : '#c62828'}
                  icon={netProfit >= 0 ? <TrendingUp /> : <TrendingDown />} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard label="Zakat Due (2.5%)"   value={fmtPKR(zakatDue)}
                  sub="Based on net profit"
                  accent="#b8860b" icon={<Receipt />} />
              </Grid>
            </Grid>

            {/* ── Monthly P&L Chart — FULL WIDTH ───────────────────────────── */}
            <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2.5, p: 3.5, mb: 3, bgcolor: '#fff' }}>
              <SectionTitle title="Monthly P&L — Revenue · COGS · Expenses · Net Profit" icon={<TrendingUp />} />
              {revenueData.length === 0
                ? <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, color: 'text.disabled' }}>
                    <Typography>No monthly data for selected period</Typography>
                  </Box>
                : <>
                    <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
                      {[
                        { color: '#1976d2', label: 'Revenue',    desc: 'Total invoiced' },
                        { color: '#c62828', label: 'COGS',       desc: 'Cost of goods sold' },
                        { color: '#ef5350', label: 'Expenses',   desc: 'Operating expenses' },
                        { color: '#2e7d32', label: 'Net Profit', desc: 'Revenue − COGS − Expenses' },
                      ].map(item => (
                        <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: .8 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: 2, bgcolor: item.color, flexShrink: 0 }} />
                          <Box>
                            <Typography sx={{ fontSize: '.75rem', fontWeight: 700, color: item.color, lineHeight: 1.2 }}>{item.label}</Typography>
                            <Typography sx={{ fontSize: '.62rem', color: 'text.disabled', lineHeight: 1.2 }}>{item.desc}</Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={revenueData} margin={{ top: 10, right: 24, left: 0, bottom: 20 }} barGap={4} barCategoryGap="28%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: '#aaa', fontSize: 13 }} tickLine={false} axisLine={{ stroke: '#ececec' }} />
                        <YAxis tick={{ fill: '#aaa', fontSize: 13 }} tickFormatter={yFmt} width={68} tickLine={false} axisLine={false} />
                        <Tooltip {...TT} formatter={(v, name) => [`PKR ${fmt(v)}`, name]} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                        <Legend iconSize={12} wrapperStyle={{ fontSize: 13, paddingTop: 14 }} iconType="circle" />
                        <Bar name="Revenue"    dataKey="revenue"  fill="#1976d2" radius={[5, 5, 0, 0]} maxBarSize={40} />
                        <Bar name="COGS"       dataKey="cogs"     fill="#c62828" radius={[5, 5, 0, 0]} maxBarSize={40} />
                        <Bar name="Expenses"   dataKey="expenses" fill="#ef5350" radius={[5, 5, 0, 0]} maxBarSize={40} />
                        <Bar name="Net Profit" dataKey="profit"   fill="#2e7d32" radius={[5, 5, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
              }
            </Paper>

            {/* ── Cash Flow Analysis — FULL WIDTH ─────────────────────────── */}
            <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2.5, p: 3.5, mb: 3, bgcolor: '#fff' }}>
              <SectionTitle title="Cash Flow Analysis" icon={<Assessment />} />
              {cashFlowData.length === 0
                ? <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'text.disabled' }}>
                    <Typography>No cash flow data</Typography>
                  </Box>
                : <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={cashFlowData} margin={{ top: 10, right: 24, left: 0, bottom: 20 }} barGap={4} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: '#aaa', fontSize: 13 }} tickLine={false} axisLine={{ stroke: '#ececec' }} />
                      <YAxis tick={{ fill: '#aaa', fontSize: 13 }} tickFormatter={yFmt} width={68} tickLine={false} axisLine={false} />
                      <Tooltip {...TT} formatter={(v, name) => [`PKR ${fmt(v)}`, name]} />
                      <Legend iconSize={12} wrapperStyle={{ fontSize: 13, paddingTop: 14 }} iconType="circle" />
                      <Bar name="Operating" dataKey="operating" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={48} />
                      <Bar name="Investing" dataKey="investing" fill="#6366f1" radius={[5, 5, 0, 0]} maxBarSize={48} />
                      <Bar name="Financing" dataKey="financing" fill="#f59e0b" radius={[5, 5, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </Paper>

            {/* ── Expense Breakdown — FULL WIDTH ───────────────────────────── */}
            <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2.5, p: 3.5, mb: 3, bgcolor: '#fff' }}>
              <SectionTitle title="Expense Breakdown by Category" icon={<Receipt />} />
              {expenseBreakdown.length === 0
                ? <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'text.disabled' }}>
                    <Typography>No expense data</Typography>
                  </Box>
                : <Grid container spacing={4} alignItems="center">
                    <Grid item xs={12} md={5}>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                            dataKey="amount" paddingAngle={3} labelLine={false}>
                            {expenseBreakdown.map((e, i) => <Cell key={i} fill={e.color || PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip {...TT} formatter={v => [`PKR ${fmt(v)}`, '']} />
                          <Legend iconSize={12} wrapperStyle={{ fontSize: 13 }} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </Grid>
                    <Grid item xs={12} md={7}>
                      {expenseBreakdown.map((e, i) => (
                        <Box key={i} sx={{ py: 1.2, borderBottom: i < expenseBreakdown.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: e.color || PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                              <Typography sx={{ fontSize: '.88rem', fontWeight: 500 }}>{e.category}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              <Typography sx={{ fontWeight: 700, fontSize: '.88rem' }}>PKR {fmt(e.amount)}</Typography>
                              <Typography sx={{ color: 'text.disabled', fontSize: '.82rem', minWidth: 40 }}>{e.percentage}%</Typography>
                            </Box>
                          </Box>
                          <Box sx={{ ml: 2.5 }}>
                            <LinearProgress variant="determinate" value={e.percentage}
                              sx={{ height: 5, borderRadius: 3, bgcolor: '#ececec', '& .MuiLinearProgress-bar': { bgcolor: e.color || PIE_COLORS[i % PIE_COLORS.length], borderRadius: 3 } }} />
                          </Box>
                        </Box>
                      ))}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2, mt: 1, borderTop: '2px solid #ef5350' }}>
                        <Typography sx={{ fontWeight: 700 }}>Total Expenses</Typography>
                        <Typography sx={{ fontWeight: 800, color: 'error.main' }}>PKR {fmt(totalExpenses)}</Typography>
                      </Box>
                    </Grid>
                  </Grid>
              }
            </Paper>

            {/* ── Profitability Metrics — FULL WIDTH ───────────────────────── */}
            {profitabilityMetrics.length > 0 && (
              <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2.5, p: 3.5, mb: 3, bgcolor: '#fff' }}>
                <SectionTitle title="Profitability Metrics" icon={<TrendingUp />} />
                <Grid container spacing={2}>
                  {profitabilityMetrics.map((m, i) => (
                    <Grid item xs={12} sm={6} md={4} lg={2.4} key={i}>
                      <Box sx={{ py: 1.5, px: 2, border: '1px solid #f0f0f0', borderRadius: 2, bgcolor: '#fafafa' }}>
                        <Typography sx={{ color: 'text.secondary', fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .8, mb: .8 }}>
                          {m.metric}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: .5, mb: .8 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: 'primary.main' }}>{m.value}</Typography>
                        </Box>
                        <LinearProgress variant="determinate"
                          value={Math.min(parseFloat(m.value?.replace('%', '') || 0), 100)}
                          sx={{ height: 5, borderRadius: 3, bgcolor: '#ececec', '& .MuiLinearProgress-bar': { borderRadius: 3, background: 'linear-gradient(90deg, #10b981, #06b6d4)' } }}
                        />
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}

            {/* ── Financial Ratios — FULL WIDTH ────────────────────────────── */}
            <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2.5, p: 3.5, mb: 3, bgcolor: '#fff' }}>
              <SectionTitle title="Financial Ratios" icon={<Assessment />} />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#fafafa' }}>
                          {['Ratio', 'Value', 'Benchmark', 'Status'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 700, fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: .6, color: 'text.secondary', py: 1.5, borderBottom: '2px solid #f0f0f0' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {financialRatios.length === 0
                          ? <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.disabled' }}>No data</TableCell></TableRow>
                          : financialRatios.map((r, i) => (
                            <TableRow key={i} sx={{ '&:hover': { bgcolor: '#fafafa' }, borderBottom: '1px solid #f5f5f5' }}>
                              <TableCell sx={{ fontWeight: 600, fontSize: '.85rem' }}>{r.ratio}</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: 'primary.main', fontSize: '.88rem' }}>{r.value}</TableCell>
                              <TableCell sx={{ color: 'text.secondary', fontSize: '.82rem' }}>{r.benchmark}</TableCell>
                              <TableCell>
                                <Chip label={r.status?.toUpperCase()} size="small"
                                  color={r.status === 'excellent' ? 'success' : 'primary'} variant="outlined"
                                  sx={{ fontSize: '.62rem', height: 20, fontWeight: 700 }} />
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
            </Paper>

            {/* ── Top Revenue Sources — FULL WIDTH ─────────────────────────── */}
            <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2.5, p: 3.5, mb: 3, bgcolor: '#fff' }}>
              <SectionTitle title="Top Revenue Sources" icon={<AttachMoney />} />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#fafafa' }}>
                          {['Source', 'Revenue', 'Count'].map(h => (
                            <TableCell key={h} align={h !== 'Source' ? 'right' : 'left'}
                              sx={{ fontWeight: 700, fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: .6, color: 'text.secondary', py: 1.5, borderBottom: '2px solid #f0f0f0' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topRevenueSources.length === 0
                          ? <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.disabled' }}>No data</TableCell></TableRow>
                          : topRevenueSources.map((s, i) => {
                              const pct = totalRevenue > 0 ? ((s.revenue / totalRevenue) * 100).toFixed(1) : '0.0'
                              return (
                                <TableRow key={i} sx={{ '&:hover': { bgcolor: '#fafafa' }, borderBottom: '1px solid #f5f5f5' }}>
                                  <TableCell>
                                    <Typography sx={{ fontWeight: 700, fontSize: '.85rem' }}>{s.source}</Typography>
                                    <LinearProgress variant="determinate" value={Math.min(parseFloat(pct), 100)}
                                      sx={{ height: 4, borderRadius: 2, mt: .5, bgcolor: '#ececec', '& .MuiLinearProgress-bar': { bgcolor: '#1976d2', borderRadius: 2 } }} />
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '.88rem', whiteSpace: 'nowrap' }}>
                                    PKR {fmt(s.revenue)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: 'text.secondary', fontSize: '.82rem' }}>
                                    {s.count} txn{s.count !== 1 ? 's' : ''}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                      </TableBody>
                    </Table>
                  </TableContainer>
            </Paper>

            {/* ── Zakat Banner ─────────────────────────────────────────────── */}
            {netProfit > 0 && (
              <Paper elevation={0} sx={{
                border: 'none', borderRadius: 2.5, p: { xs: 3, md: 4 }, mt: 3,
                background: 'linear-gradient(135deg, #1a472a 0%, #2d6a4f 60%, #40916c 100%)',
                color: '#fff', overflow: 'hidden', position: 'relative',
              }}>
                <Box sx={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2, p: 1.5, fontSize: 28 }}>☪</Box>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>Zakat Summary</Typography>
                    <Typography variant="body2" sx={{ opacity: .8 }}>2.5% of net profit · Consult a scholar for your situation</Typography>
                  </Box>
                </Box>
                <Grid container spacing={3}>
                  {[
                    { label: 'Net Profit',       value: fmtPKR(netProfit), color: '#fff' },
                    { label: 'Zakat Due (2.5%)', value: fmtPKR(zakatDue),  color: '#ffd700' },
                    { label: 'Nisab Status',      chip: netProfit >= 100000 ? 'Zakat Applicable' : 'Below Nisab', chipColor: netProfit >= 100000 ? '#ffd700' : 'rgba(255,255,255,0.3)', chipText: netProfit >= 100000 ? '#1a472a' : '#fff' },
                  ].map((item, i) => (
                    <Grid item xs={12} sm={4} key={i}>
                      <Typography sx={{ opacity: .7, textTransform: 'uppercase', letterSpacing: 1, fontSize: '.65rem', display: 'block', mb: .5 }}>{item.label}</Typography>
                      {item.chip
                        ? <Chip label={item.chip} sx={{ fontWeight: 700, fontSize: '.8rem', bgcolor: item.chipColor, color: item.chipText, mt: .5 }} />
                        : <Typography variant="h4" sx={{ fontWeight: 800, color: item.color }}>{item.value}</Typography>}
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}

          </Box>
        </Box>
      </LocalizationProvider>
    </RouteGuard>
  )
}