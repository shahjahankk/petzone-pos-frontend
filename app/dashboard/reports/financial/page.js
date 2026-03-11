'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
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

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)',
    fontFamily: "'DM Sans', sans-serif",
    p: 3,
  },
  header: {
    background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.08) 100%)',
    border: '1px solid rgba(16,185,129,0.25)',
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
  value: (c) => ({ color: c || '#fff', fontWeight: 700, fontSize: '1.75rem', mt: 0.5 }),
  sectionTitle: { color: '#fff', fontWeight: 600, fontSize: '1rem', mb: 2 },
  tableHead: { background: 'rgba(16,185,129,0.08)' },
  tableCell: { color: 'rgba(255,255,255,0.65)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' },
  tableHeadCell: { color: '#6ee7b7', fontWeight: 700, borderBottom: '1px solid rgba(16,185,129,0.25)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 },
}

const inputSx = {
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(16,185,129,0.5)' },
    '&.Mui-focused fieldset': { borderColor: '#10b981' },
  },
  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#0a1628', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, color: '#fff', fontSize: 12 },
}

export default function FinancialReportsPage() {
  const dispatch = useDispatch()
  const { financialReports, isLoading, error } = useSelector((s) => s.reports)
  const [filters, setFilters] = useState({
    period: 'monthly', year: new Date().getFullYear(), quarter: 'Q1',
    dateFrom: new Date(Date.now() - 365 * 86400000),
    dateTo: new Date(),
  })

  useEffect(() => { dispatch(fetchFinancialReports(filters)) }, [dispatch, filters])

  const revenueData = Array.isArray(financialReports?.revenueByPeriod) ? financialReports.revenueByPeriod : []
  const cashFlowData = Array.isArray(financialReports?.cashFlowData) ? financialReports.cashFlowData : []
  const expenseBreakdown = Array.isArray(financialReports?.expenseBreakdown) ? financialReports.expenseBreakdown : []
  const profitabilityMetrics = Array.isArray(financialReports?.profitabilityMetrics) ? financialReports.profitabilityMetrics : []
  const financialRatios = Array.isArray(financialReports?.financialRatios) ? financialReports.financialRatios : []
  const topRevenueSources = Array.isArray(financialReports?.topRevenueSources) ? financialReports.topRevenueSources : []

  const PIE_COLORS = ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6']

  const handleExportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Revenue', financialReports?.totalRevenue || 0],
      ['Net Profit', financialReports?.netProfit || 0],
      ['Cash Flow', financialReports?.cashFlow || 0],
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
        <Box sx={styles.page}>
          <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

          {/* Header */}
          <Box sx={styles.header}>
            <Box>
              <Typography sx={{ color: '#6ee7b7', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 2, mb: 0.5 }}>
                Reports / Financial
              </Typography>
              <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700 }}>Financial Reports</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', mt: 0.5, fontSize: '0.875rem' }}>
                Profitability, cash flow, and financial ratios
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => dispatch(fetchFinancialReports(filters))} disabled={isLoading}
                startIcon={<Refresh />} variant="outlined"
                sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', '&:hover': { borderColor: '#10b981', background: 'rgba(16,185,129,0.08)' } }}>
                Refresh
              </Button>
              <Button onClick={handleExportCSV} startIcon={<Download />} variant="contained"
                sx={{ background: 'linear-gradient(135deg, #10b981, #059669)', '&:hover': { background: 'linear-gradient(135deg, #059669, #047857)' } }}>
                Export CSV
              </Button>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Filters */}
          <Paper sx={styles.filterPaper} elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <FilterList sx={{ color: '#10b981', fontSize: 18 }} />
              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem' }}>Filters</Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small" sx={inputSx}>
                  <InputLabel>Period</InputLabel>
                  <Select value={filters.period} onChange={(e) => setFilters(p => ({ ...p, period: e.target.value }))} label="Period">
                    {['daily','weekly','monthly','quarterly','yearly'].map(v => <MenuItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small" sx={inputSx}>
                  <InputLabel>Year</InputLabel>
                  <Select value={filters.year} onChange={(e) => setFilters(p => ({ ...p, year: e.target.value }))} label="Year">
                    {[2026,2025,2024,2023,2022].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small" sx={inputSx}>
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
                  slotProps={{ textField: { fullWidth: true, size: 'small', sx: inputSx } }} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker enableAccessibleFieldDOMStructure={false} label="To Date" value={filters.dateTo}
                  onChange={(d) => setFilters(p => ({ ...p, dateTo: d }))}
                  slots={{ textField: TextField }}
                  slotProps={{ textField: { fullWidth: true, size: 'small', sx: inputSx } }} />
              </Grid>
            </Grid>
          </Paper>

          {/* Summary Cards */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {[
              { label: 'Total Revenue', value: fmt(financialReports?.totalRevenue), accent: '#10b981', icon: <AttachMoney /> },
              { label: 'Net Profit', value: fmt(financialReports?.netProfit), accent: '#06b6d4', icon: <TrendingUp /> },
              { label: 'Cash Flow', value: fmt(financialReports?.cashFlow), accent: '#6366f1', icon: <Receipt /> },
              { label: 'Profit Margin', value: `${Number(financialReports?.profitMargin || 0).toFixed(1)}%`, accent: '#f59e0b', icon: <PieIcon /> },
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

          {/* Revenue Trend + Expense Breakdown */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ ...styles.paper, p: 2.5, height: 360, display: 'flex', flexDirection: 'column' }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Revenue vs Expenses</Typography>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={revenueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} tickFormatter={v => `${Math.round(v/1000)}k`} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={v => [Number(v).toLocaleString(), '']} />
                      <Legend iconSize={10} wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                      <Line name="Revenue" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      <Line name="Expenses" type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ ...styles.paper, p: 2.5, height: 360, display: 'flex', flexDirection: 'column' }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Expense Breakdown</Typography>
                {expenseBreakdown.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.25)' }}>No expense data</Typography>
                  </Box>
                ) : (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                          dataKey="amount" paddingAngle={2} labelLine={false}>
                          {expenseBreakdown.map((e, i) => <Cell key={i} fill={e.color || PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} formatter={v => [Number(v).toLocaleString(), '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Box sx={{ mt: 1 }}>
                      {expenseBreakdown.map((e, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: e.color || PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', flex: 1 }}>{e.category}</Typography>
                          <Typography sx={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>{Number(e.amount || 0).toLocaleString()}</Typography>
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
              <Paper sx={{ ...styles.paper, p: 2.5, height: 340, display: 'flex', flexDirection: 'column' }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Cash Flow Analysis</Typography>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={cashFlowData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} tickFormatter={v => `${Math.round(v/1000)}k`} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Legend iconSize={10} wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                      <Bar name="Operating" dataKey="operating" fill="#10b981" radius={[3,3,0,0]} maxBarSize={28} />
                      <Bar name="Investing" dataKey="investing" fill="#6366f1" radius={[3,3,0,0]} maxBarSize={28} />
                      <Bar name="Financing" dataKey="financing" fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper sx={{ ...styles.paper, p: 2.5, height: 340, display: 'flex', flexDirection: 'column' }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Profitability Metrics</Typography>
                <Box sx={{ flex: 1, overflow: 'auto', pr: 0.5 }}>
                  {profitabilityMetrics.length === 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.25)' }}>No metrics data</Typography>
                    </Box>
                  ) : profitabilityMetrics.map((m, i) => (
                    <Box key={i} sx={{ mb: 2.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', fontWeight: 500 }}>{m.metric}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography sx={{ color: '#10b981', fontWeight: 700, fontSize: '0.82rem' }}>{m.value}</Typography>
                          {m.trend?.includes('↑')
                            ? <ArrowUpward sx={{ fontSize: 13, color: '#10b981' }} />
                            : <ArrowDownward sx={{ fontSize: 13, color: '#ef4444' }} />}
                        </Box>
                      </Box>
                      <LinearProgress variant="determinate"
                        value={Math.min(parseFloat(m.value?.replace('%','') || 0), 100)}
                        sx={{
                          height: 6, borderRadius: 3,
                          bgcolor: 'rgba(255,255,255,0.07)',
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
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Financial Ratios</Typography>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Ratio', 'Value', 'Benchmark', 'Status'].map(h => (
                          <TableCell key={h} sx={{ ...styles.tableHeadCell, background: 'rgba(16,185,129,0.08)' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {financialRatios.length === 0 ? (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ ...styles.tableCell, py: 4 }}>No data</TableCell></TableRow>
                      ) : financialRatios.map((r, i) => (
                        <TableRow key={i} sx={{ '&:hover': { background: 'rgba(16,185,129,0.04)' } }}>
                          <TableCell sx={styles.tableCell}>{r.ratio}</TableCell>
                          <TableCell sx={{ ...styles.tableCell, fontWeight: 600, color: '#6ee7b7' }}>{r.value}</TableCell>
                          <TableCell sx={styles.tableCell}>{r.benchmark}</TableCell>
                          <TableCell sx={styles.tableCell}>
                            <Chip label={r.status?.toUpperCase()} size="small" sx={{
                              background: r.status === 'excellent' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                              color: r.status === 'excellent' ? '#10b981' : '#818cf8',
                              fontSize: '0.65rem', height: 20,
                            }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Top Revenue Sources</Typography>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Source', 'Revenue', 'Growth'].map(h => (
                          <TableCell key={h} align={h !== 'Source' ? 'right' : 'left'} sx={{ ...styles.tableHeadCell, background: 'rgba(16,185,129,0.08)' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topRevenueSources.length === 0 ? (
                        <TableRow><TableCell colSpan={3} align="center" sx={{ ...styles.tableCell, py: 4 }}>No data</TableCell></TableRow>
                      ) : topRevenueSources.map((s, i) => (
                        <TableRow key={i} sx={{ '&:hover': { background: 'rgba(16,185,129,0.04)' } }}>
                          <TableCell sx={styles.tableCell}>{s.source}</TableCell>
                          <TableCell align="right" sx={{ ...styles.tableCell, color: '#6ee7b7', fontWeight: 600 }}>{Number(s.revenue || 0).toLocaleString()}</TableCell>
                          <TableCell align="right" sx={styles.tableCell}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                              {s.growth?.includes('+')
                                ? <ArrowUpward sx={{ fontSize: 13, color: '#10b981' }} />
                                : <ArrowDownward sx={{ fontSize: 13, color: '#ef4444' }} />}
                              <Typography sx={{ color: s.growth?.includes('+') ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>
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