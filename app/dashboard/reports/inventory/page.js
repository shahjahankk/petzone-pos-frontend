'use client'
import { formatDisplayDate } from '../../../../utils/displayDates'

import { useEffect, useState, useCallback } from 'react'
import { useTheme } from '@mui/material/styles'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  Alert, Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Menu, MenuItem,
} from '@mui/material'
import { Refresh, Download, Inventory, Warning, TrendingUp, Assessment } from '@mui/icons-material'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import RouteGuard from '../../../../components/auth/RouteGuard'
import api from '../../../../utils/axios'

const PIE_COLORS = ['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']
const accent = '#14b8a6'

export default function InventoryReportsPage() {
  const theme = useTheme()

  const [statistics, setStatistics] = useState({})
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const isLoading = loading
  const [exportAnchor, setExportAnchor] = useState(null)

  // Backend scopes data by role (warehouse / branch); query filters are not applied server-side yet.
  const loadInventory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/reports/inventory')
      setStatistics(res.data?.data || {})
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load inventory data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  const textMuted  = theme.palette.text.secondary
  const divider    = theme.palette.divider
  const bgPaper    = theme.palette.background.paper
  const textPrimary = theme.palette.text.primary

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

  // /reports/inventory response shape:
  // { summary: { totalItems, totalValue, stockStatusCounts, categoryCounts, turnoverRate },
  //   lowStockItems: [], topSellingItems: [], movementData: [] }
  const summary         = statistics?.summary         || {}
  const movementData    = Array.isArray(statistics?.movementData)    ? statistics.movementData    : []
  const categoryData    = summary?.categoryCounts
    ? Object.entries(summary.categoryCounts).map(([name, value], i) => ({
        name, value, color: PIE_COLORS[i % PIE_COLORS.length],
      }))
    : []
  const lowStockItems   = Array.isArray(statistics?.lowStockItems)   ? statistics.lowStockItems   : []
  const topSellingItems = Array.isArray(statistics?.topSellingItems)  ? statistics.topSellingItems : []

  const handleExportCSV = () => {
    const rows = [
      ['Item', 'Current Stock', 'Min Stock', 'Status'],
      ...lowStockItems.map(r => [r.name || r.itemName, r.current_stock || r.currentStock || 0, r.min_stock_level || r.minStockLevel || 0, r.stockStatus || 'Low']),
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    setExportAnchor(null)
  }

  const handleExportPDF = () => {
    const w = window.open('', '_blank')
    w.document.write(`<html><head><title>Inventory Report</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#f0f0f0}</style></head><body>
      <h1>Inventory Report — ${formatDisplayDate(new Date())}</h1>
      <p>Total Items: ${summary?.totalItems || 0} | Low Stock: ${summary?.stockStatusCounts?.['Low Stock'] || lowStockItems?.length || 0}</p>
      <h3>Low Stock Items</h3>
      <table><tr><th>Item</th><th>Current</th><th>Min</th><th>Status</th></tr>
      ${lowStockItems.map(r => `<tr><td>${r.name || r.itemName}</td><td>${r.current_stock || r.currentStock || 0}</td><td>${r.min_stock_level || r.minStockLevel || 0}</td><td>${r.stockStatus || 'Low'}</td></tr>`).join('')}
      </table></body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 400)
    setExportAnchor(null)
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', p: 3, width: '100%' }}>

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
                Reports / Inventory
              </Typography>
              <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ mt: 0.5 }}>
                Inventory Reports
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Stock levels, movement, and performance analytics
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => loadInventory()} disabled={isLoading}
                startIcon={<Refresh />} variant="outlined">
                Refresh
              </Button>
              <Button onClick={(e) => setExportAnchor(e.currentTarget)} startIcon={<Download />} variant="contained"
                sx={{ bgcolor: accent, '&:hover': { bgcolor: '#0d9488' } }}>
                Export
              </Button>
              <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
                <MenuItem onClick={handleExportCSV}>Export CSV</MenuItem>
                <MenuItem onClick={handleExportPDF}>Export PDF</MenuItem>
              </Menu>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Alert severity="info" sx={{ mb: 2 }}>
            Figures reflect your role: admins see all locations; warehouse users see their warehouse; cashiers see branch scope where applicable.
            Movement uses the last 7 days; top sellers use the last 30 days.
          </Alert>

          {/* Summary Cards */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {[
              { label: 'Total Items',    value: (summary?.totalItems || 0).toLocaleString(),   accent: '#14b8a6', icon: <Inventory /> },
              { label: 'Total Value',    value: (summary?.totalValue || 0).toLocaleString(),   accent: '#06b6d4', icon: <TrendingUp /> },
              { label: 'Low Stock',      value: summary?.stockStatusCounts?.['Low Stock'] || lowStockItems?.length || 0, accent: '#f59e0b', icon: <Warning /> },
              { label: 'Turnover Rate',  value: `${summary?.turnoverRate || '0'}x`,             accent: '#8b5cf6', icon: <Assessment /> },
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

          {/* ── Inventory Movement — FULL WIDTH ──────────────────────────── */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
            <Typography fontWeight={600} sx={{ mb: 2 }}>Inventory Movement</Typography>
            {movementData.length === 0
              ? <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'text.disabled' }}>
                  <Typography>No movement data for selected period</Typography>
                </Box>
              : <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={movementData} margin={{ top: 5, right: 24, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={divider} vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: textMuted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: divider }} />
                    <YAxis tick={{ fill: textMuted, fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Legend iconSize={11} wrapperStyle={{ color: textMuted, fontSize: 13 }} iconType="circle" />
                    <Line name="Received" type="monotone" dataKey="received" stroke="#14b8a6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    <Line name="Sold"     type="monotone" dataKey="sold"     stroke="#06b6d4" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    <Line name="Returned" type="monotone" dataKey="returned" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
            }
          </Paper>

          {/* ── By Category — FULL WIDTH with donut + legend side by side ─── */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
            <Typography fontWeight={600} sx={{ mb: 2 }}>Inventory by Category</Typography>
            {categoryData.length === 0
              ? <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: 'text.disabled' }}>
                  <Typography>No category data</Typography>
                </Box>
              : <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={5}>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" outerRadius={110} dataKey="value" labelLine={false}
                          label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}>
                          {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip {...tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Grid>
                  <Grid item xs={12} md={7}>
                    {categoryData.map((cat, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.8, borderBottom: i < categoryData.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cat.color, flexShrink: 0 }} />
                        <Typography sx={{ flex: 1, fontSize: '.88rem', fontWeight: 500 }}>{cat.name}</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '.88rem' }}>{cat.value} items</Typography>
                        <Typography sx={{ color: 'text.disabled', fontSize: '.78rem', minWidth: 48 }}>
                          {categoryData.length > 0 ? `${((cat.value / categoryData.reduce((s, c) => s + c.value, 0)) * 100).toFixed(1)}%` : ''}
                        </Typography>
                      </Box>
                    ))}
                  </Grid>
                </Grid>
            }
          </Paper>

          {/* Tables */}
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography fontWeight={600} sx={{ mb: 2, color: 'warning.main' }}>⚠ Low Stock Alert</Typography>
                <TableContainer sx={{ maxHeight: 320 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Item', 'Current', 'Minimum', 'Status'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', bgcolor: 'background.paper' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lowStockItems.length === 0 ? (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.disabled' }}>No low stock items</TableCell></TableRow>
                      ) : lowStockItems.map((row, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{row.name || row.itemName}</TableCell>
                          <TableCell sx={{ color: 'warning.main', fontWeight: 700 }}>{row.current_stock || row.currentStock || 0}</TableCell>
                          <TableCell>{row.min_stock_level || row.minStockLevel || 0}</TableCell>
                          <TableCell>
                            <Chip
                              label={row.stockStatus === 'Out of Stock' ? 'Critical' : 'Low'}
                              size="small"
                              color={row.stockStatus === 'Out of Stock' ? 'error' : 'warning'}
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 22 }}
                            />
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
                <Typography fontWeight={600} sx={{ mb: 2 }}>Top Selling Items</Typography>
                <TableContainer sx={{ maxHeight: 320 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Item', 'Sold', 'Revenue'].map(h => (
                          <TableCell key={h} align={h !== 'Item' ? 'right' : 'left'} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', bgcolor: 'background.paper' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topSellingItems.length === 0 ? (
                        <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.disabled' }}>No data</TableCell></TableRow>
                      ) : topSellingItems.map((row, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{row.name || row.itemName}</TableCell>
                          <TableCell align="right" sx={{ color: accent, fontWeight: 700 }}>
                            {Number(row.sold ?? row.totalSold ?? row.quantity_sold ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>
                            {Number(row.revenue ?? row.totalRevenue ?? 0).toLocaleString()}
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
    </RouteGuard>
  )
}