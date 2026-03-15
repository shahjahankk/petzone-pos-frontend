'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTheme } from '@mui/material/styles'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  Alert, FormControl, InputLabel, Select, MenuItem, TextField,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Menu
} from '@mui/material'
import { Refresh, FilterList, Download, Inventory, Warning, TrendingUp, Assessment } from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { fetchInventoryReports } from '../../../store/slices/reportsSlice'
import RouteGuard from '../../../../components/auth/RouteGuard'

const PIE_COLORS = ['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']
const accent = '#14b8a6'

export default function InventoryReportsPage() {
  const dispatch = useDispatch()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const { inventoryReports: rawInventoryReports, isLoading, error } = useSelector((s) => s.reports)
  // Handle both payload shapes: direct data or nested under .data
  const inventoryReports = rawInventoryReports?.data || rawInventoryReports
  const [exportAnchor, setExportAnchor] = useState(null)
  const [filters, setFilters] = useState({
    warehouse: 'all', category: 'all', status: 'all',
    dateFrom: new Date(Date.now() - 30 * 86400000),
    dateTo: new Date(),
  })

  useEffect(() => { dispatch(fetchInventoryReports(filters)) }, [dispatch, filters])

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

  const movementData = Array.isArray(inventoryReports?.movementData) ? inventoryReports.movementData : []
  const categoryData = inventoryReports?.summary?.categoryCounts
    ? Object.entries(inventoryReports.summary.categoryCounts).map(([name, value], i) => ({
        name, value, color: PIE_COLORS[i % PIE_COLORS.length],
      }))
    : []
  const lowStockItems    = Array.isArray(inventoryReports?.lowStockItems)    ? inventoryReports.lowStockItems    : []
  const topSellingItems  = Array.isArray(inventoryReports?.topSellingItems)  ? inventoryReports.topSellingItems  : []

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
      <h1>Inventory Report — ${new Date().toLocaleDateString()}</h1>
      <p>Total Items: ${inventoryReports?.summary?.totalItems || 0} | Low Stock: ${inventoryReports?.summary?.stockStatusCounts?.['Low Stock'] || 0}</p>
      <h3>Low Stock Items</h3>
      <table><tr><th>Item</th><th>Current</th><th>Min</th><th>Status</th></tr>
      ${lowStockItems.map(r => `<tr><td>${r.name || r.itemName}</td><td>${r.current_stock || r.currentStock || 0}</td><td>${r.min_stock_level || r.minStockLevel || 0}</td><td>${r.stockStatus || 'Low'}</td></tr>`).join('')}
      </table></body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 400)
    setExportAnchor(null)
  }

  const categories = ['Food','Accessories','Medicine','Litters','Toys','Grooming','Bedding','Collars & Leashes','Bowls & Feeders','Health & Wellness','Other']

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER']}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
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
              <Button onClick={() => dispatch(fetchInventoryReports(filters))} disabled={isLoading}
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

          {/* Filters */}
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <FilterList sx={{ color: accent, fontSize: 18 }} />
              <Typography fontWeight={600} fontSize="0.875rem">Filters</Typography>
            </Box>
            <Grid container spacing={2}>
              {[
                { field: 'warehouse', label: 'Warehouse', options: [{ v: 'all', l: 'All Warehouses' }, { v: 'main', l: 'Main' }] },
                { field: 'status',    label: 'Status',    options: [{ v: 'all', l: 'All' }, { v: 'in-stock', l: 'In Stock' }, { v: 'low-stock', l: 'Low Stock' }, { v: 'out-of-stock', l: 'Out of Stock' }] },
              ].map(({ field, label, options }) => (
                <Grid item xs={12} sm={6} md={2} key={field}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{label}</InputLabel>
                    <Select value={filters[field]} onChange={(e) => setFilters(p => ({ ...p, [field]: e.target.value }))} label={label}>
                      {options.map(o => <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              ))}
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select value={filters.category} onChange={(e) => setFilters(p => ({ ...p, category: e.target.value }))} label="Category">
                    <MenuItem value="all">All Categories</MenuItem>
                    {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
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
              { label: 'Total Items',    value: (inventoryReports?.summary?.totalItems || 0).toLocaleString(),   accent: '#14b8a6', icon: <Inventory /> },
              { label: 'Total Value',    value: (inventoryReports?.summary?.totalValue || 0).toLocaleString(),   accent: '#06b6d4', icon: <TrendingUp /> },
              { label: 'Low Stock',      value: inventoryReports?.summary?.stockStatusCounts?.['Low Stock'] || 0, accent: '#f59e0b', icon: <Warning /> },
              { label: 'Turnover Rate',  value: `${inventoryReports?.summary?.turnoverRate || '0'}x`,             accent: '#8b5cf6', icon: <Assessment /> },
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

          {/* Charts */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: 380, display: "flex", flexDirection: "column" }}>
                <Typography fontWeight={600} sx={{ mb: 2 }}>Inventory Movement</Typography>
                <Box sx={{ flex: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={movementData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={divider} />
                      <XAxis dataKey="date" tick={{ fill: textMuted, fontSize: 11 }} />
                      <YAxis tick={{ fill: textMuted, fontSize: 11 }} />
                      <Tooltip {...tooltipStyle} />
                      <Legend iconSize={10} wrapperStyle={{ color: textMuted, fontSize: 12 }} />
                      <Line name="Received" type="monotone" dataKey="received" stroke="#14b8a6" strokeWidth={2} dot={false} />
                      <Line name="Sold"     type="monotone" dataKey="sold"     stroke="#06b6d4" strokeWidth={2} dot={false} />
                      <Line name="Returned" type="monotone" dataKey="returned" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: 380, display: "flex", flexDirection: "column" }}>
                <Typography fontWeight={600} sx={{ mb: 2 }}>By Category</Typography>
                {categoryData.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.disabled">No category data</Typography>
                  </Box>
                ) : (
                  <Box sx={{ flex: 1 }}><ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} dataKey="value" labelLine={false}
                        label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}>
                        {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip {...tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer></Box>
                )}
              </Paper>
            </Grid>
          </Grid>

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
                          <TableCell align="right" sx={{ color: accent, fontWeight: 700 }}>{row.totalSold || row.quantity_sold || 0}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>{Number(row.totalRevenue || 0).toLocaleString()}</TableCell>
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