'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTheme } from '@mui/material/styles'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  Alert, FormControl, InputLabel, Select, MenuItem, TextField,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, LinearProgress,
} from '@mui/material'
import { Refresh, FilterList, Download, AttachMoney, TrendingUp, Receipt, PieChart as PieIcon, ArrowUpward, ArrowDownward } from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { fetchFinancialReports } from '../../../store/slices/reportsSlice'
import RouteGuard from '../../../../components/auth/RouteGuard'

const PIE_COLORS = ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6']

export default function FinancialReportsPage() {
  const dispatch = useDispatch()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const { financialReports, isLoading, error } = useSelector((s) => s.reports)
  const [filters, setFilters] = useState({
    period: 'monthly', year: new Date().getFullYear(), quarter: 'Q1',
    dateFrom: new Date(Date.now() - 365 * 86400000),
    dateTo: new Date(),
  })

  useEffect(() => { dispatch(fetchFinancialReports(filters)) }, [dispatch, filters])

  const revenueData          = Array.isArray(financialReports?.revenueByPeriod)      ? financialReports.revenueByPeriod      : []
  const cashFlowData         = Array.isArray(financialReports?.cashFlowData)         ? financialReports.cashFlowData         : []
  const expenseBreakdown     = Array.isArray(financialReports?.expenseBreakdown)     ? financialReports.expenseBreakdown     : []
  const profitabilityMetrics = Array.isArray(financialReports?.profitabilityMetrics) ? financialReports.profitabilityMetrics : []
  const financialRatios      = Array.isArray(financialReports?.financialRatios)      ? financialReports.financialRatios      : []
  const topRevenueSources    = Array.isArray(financialReports?.topRevenueSources)    ? financialReports.topRevenueSources    : []

  // ── Theme-aware colours ───────────────────────────────────────────────────
  const accent      = '#10b981'
  const textPrimary = theme.palette.text.primary
  const textMuted   = theme.palette.text.secondary
  const divider     = theme.palette.divider
  const bgPaper     = theme.palette.background.paper
  const bgDefault   = theme.palette.background.default

  const tooltipStyle = {
    contentStyle: {
      background: bgPaper,
      border: `1px solid ${divider}`,
      borderRadius: 8,
      color: textPrimary,
      fontSize: 12,
    },
    labelStyle: { color: textPrimary },
  }

  const handleExportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Revenue',  financialReports?.totalRevenue  || 0],
      ['Net Profit',     financialReports?.netProfit     || 0],
      ['Cash Flow',      financialReports?.cashFlow      || 0],
      ['Profit Margin', `${financialReports?.profitMargin || 0}%`],
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const fmt = (v) => Number(v || 0).toLocaleString()

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>

          {/* Header */}
          <Box sx={{
            bgcolor: 'background.paper',
            border: `1px solid ${divider}`,
            borderLeft: `4px solid ${accent}`,
            borderRadius: 2, p: 3, mb: 3,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <Box>
              <Typography variant="caption" sx={{ color: accent, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>
                Reports / Financial
              </Typography>
              <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ mt: 0.5 }}>
                Financial Reports
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Profitability, cash flow, and financial ratios
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => dispatch(fetchFinancialReports(filters))} disabled={isLoading}
                startIcon={<Refresh />} variant="outlined">
                Refresh
              </Button>
              <Button onClick={handleExportCSV} startIcon={<Download />} variant="contained"
                sx={{ bgcolor: accent, '&:hover': { bgcolor: '#059669' } }}>
                Export CSV
              </Button>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Filters */}
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <FilterList sx={{ color: accent, fontSize: 18 }} />
              <Typography fontWeight={600} fontSize="0.875rem">Filters</Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Period</InputLabel>
                  <Select value={filters.period} onChange={(e) => setFilters(p => ({ ...p, period: e.target.value }))} label="Period">
                    {['daily','weekly','monthly','quarterly','yearly'].map(v =>
                      <MenuItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Year</InputLabel>
                  <Select value={filters.year} onChange={(e) => setFilters(p => ({ ...p, year: e.target.value }))} label="Year">
                    {[2026,2025,2024,2023,2022].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Quarter</InputLabel>
                  <Select value={filters.quarter} onChange={(e) => setFilters(p => ({ ...p, quarter: e.target.value }))} label="Quarter">
                    {['Q1','Q2','Q3','Q4'].map(q => <MenuItem key={q} value={q}>{q}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker enableAccessibleFieldDOMStructure={false} label="From Date" value={filters.dateFrom}
                  onChange={(d) => setFilters(p => ({ ...p, dateFrom: d }))}
                  slots={{ textField: TextField }}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker enableAccessibleFieldDOMStructure={false} label="To Date" value={filters.dateTo}
                  onChange={(d) => setFilters(p => ({ ...p, dateTo: d }))}
                  slots={{ textField: TextField }}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
              </Grid>
            </Grid>
          </Paper>

          {/* Summary Cards */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {[
              { label: 'Total Revenue',  value: fmt(financialReports?.totalRevenue),                                  accent: '#10b981', icon: <AttachMoney /> },
              { label: 'Net Profit',     value: fmt(financialReports?.netProfit),                                     accent: '#06b6d4', icon: <TrendingUp /> },
              { label: 'Cash Flow',      value: fmt(financialReports?.cashFlow),                                      accent: '#6366f1', icon: <Receipt /> },
              { label: 'Profit Margin',  value: `${Number(financialReports?.profitMargin || 0).toFixed(1)}%`,         accent: '#f59e0b', icon: <PieIcon /> },
            ].map((c) => (
              <Grid item xs={12} sm={6} md={3} key={c.label}>
                <Card variant="outlined" sx={{ borderLeft: `4px solid ${c.accent}`, borderRadius: 2, transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 } }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
                          {c.label}
                        </Typography>
                        <Typography variant="h5" fontWeight={700} sx={{ color: c.accent, mt: 0.5 }}>{c.value}</Typography>
                      </Box>
                      <Box sx={{ color: c.accent, opacity: 0.7 }}>{c.icon}</Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Revenue Trend + Expense Breakdown */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <Paper variant="outlined" sx={{ p: 2.5, height: 360, display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
                <Typography fontWeight={600} sx={{ mb: 2 }}>Revenue vs Expenses</Typography>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={revenueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={divider} vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: textMuted, fontSize: 11 }} />
                      <YAxis tick={{ fill: textMuted, fontSize: 11 }} tickFormatter={v => `${Math.round(v/1000)}k`} />
                      <Tooltip {...tooltipStyle} formatter={v => [Number(v).toLocaleString(), '']} />
                      <Legend iconSize={10} wrapperStyle={{ color: textMuted, fontSize: 12 }} />
                      <Line name="Revenue"  type="monotone" dataKey="revenue"  stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      <Line name="Expenses" type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2.5, height: 360, display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
                <Typography fontWeight={600} sx={{ mb: 2 }}>Expense Breakdown</Typography>
                {expenseBreakdown.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.disabled">No expense data</Typography>
                  </Box>
                ) : (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                          dataKey="amount" paddingAngle={2} labelLine={false}>
                          {expenseBreakdown.map((e, i) => <Cell key={i} fill={e.color || PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip {...tooltipStyle} formatter={v => [Number(v).toLocaleString(), '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Box sx={{ mt: 1, overflowY: 'auto' }}>
                      {expenseBreakdown.map((e, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: e.color || PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{e.category}</Typography>
                          <Typography variant="caption" fontWeight={600}>{Number(e.amount || 0).toLocaleString()}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Cash Flow + Profitability */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} md={7}>
              <Paper variant="outlined" sx={{ p: 2.5, height: 340, display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
                <Typography fontWeight={600} sx={{ mb: 2 }}>Cash Flow Analysis</Typography>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={cashFlowData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={divider} vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: textMuted, fontSize: 11 }} />
                      <YAxis tick={{ fill: textMuted, fontSize: 11 }} tickFormatter={v => `${Math.round(v/1000)}k`} />
                      <Tooltip {...tooltipStyle} />
                      <Legend iconSize={10} wrapperStyle={{ color: textMuted, fontSize: 12 }} />
                      <Bar name="Operating" dataKey="operating" fill="#10b981" radius={[3,3,0,0]} maxBarSize={28} />
                      <Bar name="Investing" dataKey="investing" fill="#6366f1" radius={[3,3,0,0]} maxBarSize={28} />
                      <Bar name="Financing" dataKey="financing" fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper variant="outlined" sx={{ p: 2.5, height: 340, display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
                <Typography fontWeight={600} sx={{ mb: 2 }}>Profitability Metrics</Typography>
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  {profitabilityMetrics.length === 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <Typography color="text.disabled">No metrics data</Typography>
                    </Box>
                  ) : profitabilityMetrics.map((m, i) => (
                    <Box key={i} sx={{ mb: 2.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                        <Typography variant="body2" fontWeight={500} color="text.secondary">{m.metric}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" fontWeight={700} sx={{ color: accent }}>{m.value}</Typography>
                          {m.trend?.includes('↑')
                            ? <ArrowUpward sx={{ fontSize: 13, color: '#10b981' }} />
                            : <ArrowDownward sx={{ fontSize: 13, color: '#ef4444' }} />}
                        </Box>
                      </Box>
                      <LinearProgress variant="determinate"
                        value={Math.min(parseFloat(m.value?.replace('%','') || 0), 100)}
                        sx={{
                          height: 6, borderRadius: 3,
                          bgcolor: 'action.hover',
                          '& .MuiLinearProgress-bar': { borderRadius: 3, background: 'linear-gradient(90deg, #10b981, #06b6d4)' },
                        }} />
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Financial Ratios + Revenue Sources */}
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography fontWeight={600} sx={{ mb: 2 }}>Financial Ratios</Typography>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Ratio', 'Value', 'Benchmark', 'Status'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, bgcolor: 'background.paper' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {financialRatios.length === 0 ? (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.disabled' }}>No data</TableCell></TableRow>
                      ) : financialRatios.map((r, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{r.ratio}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: accent }}>{r.value}</TableCell>
                          <TableCell color="text.secondary">{r.benchmark}</TableCell>
                          <TableCell>
                            <Chip label={r.status?.toUpperCase()} size="small" color={r.status === 'excellent' ? 'success' : 'primary'} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography fontWeight={600} sx={{ mb: 2 }}>Top Revenue Sources</Typography>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Source', 'Revenue', 'Growth'].map(h => (
                          <TableCell key={h} align={h !== 'Source' ? 'right' : 'left'} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, bgcolor: 'background.paper' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topRevenueSources.length === 0 ? (
                        <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.disabled' }}>No data</TableCell></TableRow>
                      ) : topRevenueSources.map((s, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{s.source}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: accent }}>{Number(s.revenue || 0).toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                              {s.growth?.includes('+')
                                ? <ArrowUpward sx={{ fontSize: 13, color: '#10b981' }} />
                                : <ArrowDownward sx={{ fontSize: 13, color: '#ef4444' }} />}
                              <Typography variant="body2" fontWeight={600} sx={{ color: s.growth?.includes('+') ? '#10b981' : '#ef4444' }}>
                                {s.growth}
                              </Typography>
                            </Box>
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