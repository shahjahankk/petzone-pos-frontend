'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  Alert, FormControl, InputLabel, Select, MenuItem, TextField,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Menu,
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

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1b2a 50%, #0a0f1e 100%)',
    fontFamily: "'DM Sans', sans-serif",
    p: 3,
  },
  header: {
    background: 'linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(6,182,212,0.08) 100%)',
    border: '1px solid rgba(20,184,166,0.25)',
    borderRadius: 3, p: 3, mb: 3,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  statCard: (accent) => ({
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${accent}35`,
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
  label: { color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1 },
  value: (c) => ({ color: c || '#fff', fontWeight: 700, fontSize: '1.8rem', mt: 0.5 }),
  sectionTitle: { color: '#fff', fontWeight: 600, fontSize: '1rem', mb: 2 },
  tableHead: { background: 'rgba(20,184,166,0.1)' },
  tableCell: { color: 'rgba(255,255,255,0.65)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' },
  tableHeadCell: { color: '#5eead4', fontWeight: 700, borderBottom: '1px solid rgba(20,184,166,0.25)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 },
}

const inputSx = {
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(20,184,166,0.5)' },
    '&.Mui-focused fieldset': { borderColor: '#14b8a6' },
  },
  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.45)' },
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#0d1b2a', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 8, color: '#fff', fontSize: 12 },
}

const PIE_COLORS = ['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']

export default function InventoryReportsPage() {
  const dispatch = useDispatch()
  const { inventoryReports, isLoading, error } = useSelector((s) => s.reports)
  const [exportAnchor, setExportAnchor] = useState(null)
  const [filters, setFilters] = useState({
    warehouse: 'all', category: 'all', status: 'all',
    dateFrom: new Date(Date.now() - 30 * 86400000),
    dateTo: new Date(),
  })

  useEffect(() => { dispatch(fetchInventoryReports(filters)) }, [dispatch, filters])

  const movementData = Array.isArray(inventoryReports?.movementData) ? inventoryReports.movementData : []
  const categoryData = inventoryReports?.summary?.categoryCounts
    ? Object.entries(inventoryReports.summary.categoryCounts).map(([name, value], i) => ({
        name, value, color: PIE_COLORS[i % PIE_COLORS.length],
      }))
    : []
  const lowStockItems = Array.isArray(inventoryReports?.lowStockItems) ? inventoryReports.lowStockItems : []
  const topSellingItems = Array.isArray(inventoryReports?.topSellingItems) ? inventoryReports.topSellingItems : []

  const handleExportCSV = () => {
    const rows = [
      ['Item', 'Current Stock', 'Min Stock', 'Status'],
      ...lowStockItems.map(r => [
        r.name || r.itemName,
        r.current_stock || r.currentStock || 0,
        r.min_stock_level || r.minStockLevel || 0,
        r.stockStatus || 'Low',
      ]),
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
        <Box sx={styles.page}>
          <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

          {/* Header */}
          <Box sx={styles.header}>
            <Box>
              <Typography sx={{ color: '#5eead4', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 2, mb: 0.5 }}>
                Reports / Inventory
              </Typography>
              <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700 }}>Inventory Reports</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', mt: 0.5, fontSize: '0.875rem' }}>
                Stock levels, movement, and performance analytics
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => dispatch(fetchInventoryReports(filters))} disabled={isLoading}
                startIcon={<Refresh />} variant="outlined"
                sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', '&:hover': { borderColor: '#14b8a6', background: 'rgba(20,184,166,0.1)' } }}>
                Refresh
              </Button>
              <Button onClick={(e) => setExportAnchor(e.currentTarget)} startIcon={<Download />} variant="contained"
                sx={{ background: 'linear-gradient(135deg, #14b8a6, #06b6d4)', '&:hover': { background: 'linear-gradient(135deg, #0d9488, #0891b2)' } }}>
                Export
              </Button>
              <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}
                PaperProps={{ sx: { background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.1)' } }}>
                <MenuItem onClick={handleExportCSV} sx={{ color: '#fff' }}>Export CSV</MenuItem>
                <MenuItem onClick={handleExportPDF} sx={{ color: '#fff' }}>Export PDF</MenuItem>
              </Menu>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Filters */}
          <Paper sx={styles.filterPaper} elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <FilterList sx={{ color: '#14b8a6', fontSize: 18 }} />
              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem' }}>Filters</Typography>
            </Box>
            <Grid container spacing={2}>
              {[
                { field: 'warehouse', label: 'Warehouse', options: [{ v: 'all', l: 'All Warehouses' }, { v: 'main', l: 'Main' }] },
                { field: 'status', label: 'Status', options: [{ v: 'all', l: 'All' }, { v: 'in-stock', l: 'In Stock' }, { v: 'low-stock', l: 'Low Stock' }, { v: 'out-of-stock', l: 'Out of Stock' }] },
              ].map(({ field, label, options }) => (
                <Grid item xs={12} sm={6} md={2} key={field}>
                  <FormControl fullWidth size="small" sx={inputSx}>
                    <InputLabel>{label}</InputLabel>
                    <Select value={filters[field]} onChange={(e) => setFilters(p => ({ ...p, [field]: e.target.value }))} label={label}>
                      {options.map(o => <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              ))}
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small" sx={inputSx}>
                  <InputLabel>Category</InputLabel>
                  <Select value={filters.category} onChange={(e) => setFilters(p => ({ ...p, category: e.target.value }))} label="Category">
                    <MenuItem value="all">All Categories</MenuItem>
                    {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
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
              { label: 'Total Items', value: (inventoryReports?.summary?.totalItems || 0).toLocaleString(), accent: '#14b8a6', icon: <Inventory /> },
              { label: 'Total Value', value: `${(inventoryReports?.summary?.totalValue || 0).toLocaleString()}`, accent: '#06b6d4', icon: <TrendingUp /> },
              { label: 'Low Stock', value: inventoryReports?.summary?.stockStatusCounts?.['Low Stock'] || '0', accent: '#f59e0b', icon: <Warning /> },
              { label: 'Turnover Rate', value: `${inventoryReports?.summary?.turnoverRate || '0'}x`, accent: '#8b5cf6', icon: <Assessment /> },
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
                <Typography sx={styles.sectionTitle}>Inventory Movement</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={movementData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend iconSize={10} wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                    <Line name="Received" type="monotone" dataKey="received" stroke="#14b8a6" strokeWidth={2} dot={false} />
                    <Line name="Sold" type="monotone" dataKey="sold" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    <Line name="Returned" type="monotone" dataKey="returned" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={styles.sectionTitle}>By Category</Typography>
                {categoryData.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.3)' }}>No category data</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} dataKey="value" labelLine={false}
                        label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}>
                        {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip {...TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Tables */}
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={{ ...styles.sectionTitle, color: '#fbbf24' }}>⚠ Low Stock Alert</Typography>
                <TableContainer sx={{ maxHeight: 320 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Item', 'Current', 'Minimum', 'Status'].map(h => (
                          <TableCell key={h} sx={{ ...styles.tableHeadCell, background: 'rgba(20,184,166,0.1)' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lowStockItems.length === 0 ? (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ ...styles.tableCell, py: 4 }}>No low stock items</TableCell></TableRow>
                      ) : lowStockItems.map((row, i) => (
                        <TableRow key={i} sx={{ '&:hover': { background: 'rgba(20,184,166,0.05)' } }}>
                          <TableCell sx={styles.tableCell}>{row.name || row.itemName}</TableCell>
                          <TableCell sx={{ ...styles.tableCell, color: '#fbbf24', fontWeight: 600 }}>{row.current_stock || row.currentStock || 0}</TableCell>
                          <TableCell sx={styles.tableCell}>{row.min_stock_level || row.minStockLevel || 0}</TableCell>
                          <TableCell sx={styles.tableCell}>
                            <Chip
                              label={row.stockStatus === 'Out of Stock' ? 'Critical' : 'Low'}
                              size="small"
                              sx={{
                                background: row.stockStatus === 'Out of Stock' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                color: row.stockStatus === 'Out of Stock' ? '#ef4444' : '#f59e0b',
                                fontSize: '0.7rem', height: 22,
                              }}
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
              <Paper sx={{ ...styles.paper, p: 2.5 }} elevation={0}>
                <Typography sx={styles.sectionTitle}>Top Selling Items</Typography>
                <TableContainer sx={{ maxHeight: 320 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Item', 'Sold', 'Revenue'].map(h => (
                          <TableCell key={h} align={h !== 'Item' ? 'right' : 'left'} sx={{ ...styles.tableHeadCell, background: 'rgba(20,184,166,0.1)' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topSellingItems.length === 0 ? (
                        <TableRow><TableCell colSpan={3} align="center" sx={{ ...styles.tableCell, py: 4 }}>No data</TableCell></TableRow>
                      ) : topSellingItems.map((row, i) => (
                        <TableRow key={i} sx={{ '&:hover': { background: 'rgba(20,184,166,0.05)' } }}>
                          <TableCell sx={styles.tableCell}>{row.name || row.itemName}</TableCell>
                          <TableCell align="right" sx={{ ...styles.tableCell, color: '#5eead4', fontWeight: 600 }}>{row.totalSold || row.quantity_sold || 0}</TableCell>
                          <TableCell align="right" sx={{ ...styles.tableCell, color: '#34d399', fontWeight: 600 }}>{Number(row.totalRevenue || 0).toLocaleString()}</TableCell>
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