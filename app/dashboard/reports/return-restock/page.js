'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTheme } from '@mui/material/styles'
import {
  Box, Paper, Typography, Grid, TextField, FormControl,
  InputLabel, Select, MenuItem, Button, Alert, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, CircularProgress, IconButton, Tooltip,
  Card, CardContent, Collapse,
} from '@mui/material'
import { useSelector } from 'react-redux'
import RouteGuard from '../../../../components/auth/RouteGuard'
import api from '../../../../utils/axios'
import {
  Refresh, FilterList, Clear,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AssignmentReturn as ReturnIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material'

const STATUS_MAP = {
  COMPLETED: { color: 'success', label: 'Completed' },
  PARTIAL:   { color: 'warning', label: 'Partial'   },
  PENDING:   { color: 'error',   label: 'Pending'   },
}

const fmt = (v) =>
  Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const fmtDate = (d) => {
  if (!d) return '—'
  const s = String(d).substring(0, 10).split('-')
  return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : d
}

// ── Expandable row: summary row + collapsible item detail table ───────────────
function ReturnRow({ row }) {
  const [open, setOpen] = useState(false)
  const statusInfo = STATUS_MAP[row.status] || { color: 'default', label: row.status || '—' }

  return (
    <>
      {/* Summary row */}
      <TableRow
        hover
        sx={{ cursor: 'pointer', bgcolor: open ? 'action.selected' : 'inherit' }}
        onClick={() => setOpen(o => !o)}
      >
        <TableCell sx={{ width: 40, py: 0.8 }}>
          <IconButton size="small" onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.82rem', py: 0.8 }}>{fmtDate(row.date)}</TableCell>
        <TableCell sx={{ fontWeight: 700, color: 'primary.main', fontSize: '0.82rem', py: 0.8 }}>{row.invoiceNo}</TableCell>
        <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem', py: 0.8 }}>{row.returnNo}</TableCell>
        <TableCell sx={{ py: 0.8 }}>
          <Chip label={row.scopeType || '—'} size="small" variant="outlined"
            color={row.scopeType === 'BRANCH' ? 'primary' : row.scopeType === 'WAREHOUSE' ? 'secondary' : 'default'}
            sx={{ fontSize: '0.68rem', height: 20 }} />
        </TableCell>
        <TableCell sx={{ fontSize: '0.82rem', py: 0.8 }}>{row.scopeName || '—'}</TableCell>
        <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary', py: 0.8 }}>{row.customer || '—'}</TableCell>
        <TableCell align="center" sx={{ py: 0.8 }}>
          <Chip label={row.items?.length || 0} size="small" color="info" variant="outlined" sx={{ fontSize: '0.72rem', height: 20 }} />
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 700, color: 'warning.main', py: 0.8 }}>{fmt(row.totalReturnedQty)}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main', py: 0.8 }}>{fmt(row.totalRestockedQty)}</TableCell>
        <TableCell align="right" sx={{ fontWeight: row.totalNotRestocked > 0 ? 700 : 400, color: row.totalNotRestocked > 0 ? 'error.main' : 'text.disabled', py: 0.8 }}>
          {fmt(row.totalNotRestocked)}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 700, py: 0.8 }}>{fmt(row.totalValue)}</TableCell>
        <TableCell sx={{ py: 0.8 }}>
          <Chip label={statusInfo.label} size="small" color={statusInfo.color} variant="outlined" sx={{ fontSize: '0.68rem', height: 20 }} />
        </TableCell>
        <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', py: 0.8 }}>{row.performedBy || '—'}</TableCell>
      </TableRow>

      {/* Expanded: per-item detail table */}
      <TableRow>
        <TableCell colSpan={14} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ mx: 2, mb: 1.5, mt: 0.5 }}>
              <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ReturnIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>
                    Items in {row.returnNo} &nbsp;|&nbsp; Original Invoice: {row.invoiceNo}
                    {row.customer && ` &nbsp;|&nbsp; Customer: ${row.customer}`}
                  </Typography>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'background.default' }}>
                      {['#', 'SKU', 'Item Name', 'Category', 'Unit Price', 'Qty Returned', 'Qty Restocked', 'Not Restocked', 'Return Value', 'Restock Status'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', py: 0.9 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(row.items || []).map((item, idx) => {
                      const notRestocked  = Math.max(0, item.returnedQty - item.restockedQty)
                      const itemStatus    = item.restockedQty === 0 ? 'PENDING' : notRestocked > 0 ? 'PARTIAL' : 'COMPLETED'
                      const itemStatusInfo = STATUS_MAP[itemStatus]
                      const returnValue   = item.returnedQty * item.unitPrice
                      return (
                        <TableRow key={idx} hover>
                          <TableCell sx={{ color: 'text.disabled', fontSize: '0.75rem', py: 0.8 }}>{idx + 1}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.secondary', py: 0.8 }}>{item.sku || '—'}</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem', py: 0.8 }}>{item.itemName || '—'}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', py: 0.8 }}>{item.category || '—'}</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.82rem', py: 0.8 }}>{fmt(item.unitPrice)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'warning.main', py: 0.8 }}>{fmt(item.returnedQty)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main', py: 0.8 }}>{fmt(item.restockedQty)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: notRestocked > 0 ? 700 : 400, color: notRestocked > 0 ? 'error.main' : 'text.disabled', py: 0.8 }}>
                            {fmt(notRestocked)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, py: 0.8 }}>{fmt(returnValue)}</TableCell>
                          <TableCell sx={{ py: 0.8 }}>
                            <Chip label={itemStatusInfo.label} size="small" color={itemStatusInfo.color} variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {(!row.items || row.items.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={10} align="center" sx={{ py: 2, color: 'text.disabled', fontSize: '0.82rem' }}>
                          No item details available for this return
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReturnRestockReportPage() {
  const theme    = useTheme()
  const { user } = useSelector((s) => s.auth)

  const [filters, setFilters] = useState({
    scopeType: 'ALL', scopeId: '', status: 'ALL', search: '', from: '', to: '',
  })
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [source,  setSource]  = useState('')

  const accentColor = theme.palette.mode === 'dark' ? '#a855f7' : '#7c3aed'

  // ── Transform dedicated endpoint data ─────────────────────────────────────
  const buildFromRestockEndpoint = (data) => {
    const groups = {}
    data.forEach(r => {
      const key = String(r.invoice_no || r.id)
      if (!groups[key]) {
        groups[key] = {
          id: r.id, date: r.date,
          invoiceNo: r.invoice_no || '—',
          returnNo:  r.return_no  || '—',
          scopeType: r.scope_type || '',
          scopeName: r.scope_name || '',
          customer:  r.customer_name || '',
          performedBy: r.performed_by || '',
          items: [], totalReturnedQty: 0, totalRestockedQty: 0, totalNotRestocked: 0, totalValue: 0,
        }
      }
      const returnedQty  = Number(r.returned_qty  || 0)
      const restockedQty = Number(r.restocked_qty || 0)
      const notRestocked = Number(r.not_restocked_qty ?? Math.max(0, returnedQty - restockedQty))
      const unitPrice    = Number(r.unit_price    || 0)
      groups[key].items.push({ sku: r.sku || '', itemName: r.item_name || '', category: r.category || '', unitPrice, returnedQty, restockedQty })
      groups[key].totalReturnedQty  += returnedQty
      groups[key].totalRestockedQty += restockedQty
      groups[key].totalNotRestocked += notRestocked
      groups[key].totalValue        += returnedQty * unitPrice
    })
    return Object.values(groups).map(g => ({
      ...g,
      status: g.totalRestockedQty === 0 ? 'PENDING' : g.totalNotRestocked > 0 ? 'PARTIAL' : 'COMPLETED',
    }))
  }

  // ── Transform /sales/returns fallback data ─────────────────────────────────
  // The /sales/returns endpoint returns return headers only — no items array.
  // We enrich each return by fetching its original sale from /sales/:id
  // to get the line items (name, sku, qty, price).
  const buildFromSalesReturns = async (raw) => {
    const enriched = await Promise.all(raw.map(async (ret) => {
      let items = []

      // Try to fetch original sale items for this return
      // GET /sales/returns/:id returns the return with its items array
      // (same endpoint used by ReturnsPage handleViewDetails)
      try {
        const retRes  = await api.get(`/sales/returns/${ret.id}`)
        const retData = retRes.data?.data || retRes.data || {}
        const retItems = retData.items || []

        items = retItems.map(item => {
          const returnedQty  = Number(item.quantity          || 0)
          // remaining_quantity tracks how much is still pending restock
          const remainingQty = Number(item.remaining_quantity ?? item.remainingQuantity ?? returnedQty)
          // restocked = total returned - remaining
          const restockedQty = Math.max(0, returnedQty - remainingQty)
          return {
            sku:          item.sku           || '',
            itemName:     item.name          || item.productName || item.itemName || item.item_name || '',
            category:     item.category      || '',
            unitPrice:    Number(item.unit_price || item.unitPrice || item.price || 0),
            returnedQty,
            restockedQty,
          }
        })
      } catch {
        // Return details fetch failed — show return row without items
        items = []
      }

      const totalReturnedQty  = items.reduce((s, i) => s + i.returnedQty,  0)
      const totalRestockedQty = items.reduce((s, i) => s + i.restockedQty, 0)
      const totalNotRestocked = Math.max(0, totalReturnedQty - totalRestockedQty)
      const totalValue        = items.reduce((s, i) => s + i.returnedQty * i.unitPrice, 0)
        || Number(ret.total_refund || ret.totalRefund || 0)

      // Derive status from return record itself (more reliable than item calc)
      const retStatus = (ret.status || '').toUpperCase()
      const status = retStatus === 'COMPLETED' ? 'COMPLETED'
                   : retStatus === 'PENDING'   ? 'PENDING'
                   : totalRestockedQty === 0   ? 'PENDING'
                   : totalNotRestocked > 0     ? 'PARTIAL'
                   : 'COMPLETED'

      return {
        id:               ret.id,
        date:             ret.created_at    || ret.return_date,
        invoiceNo:        ret.invoice_no    || ret.original_invoice_no || '—',
        returnNo:         ret.return_no     || `RET-${ret.id}`,
        scopeType:        ret.scope_type    || (ret.warehouse_name ? 'WAREHOUSE' : ret.branch_name ? 'BRANCH' : ''),
        scopeName:        ret.warehouse_name || ret.branch_name || ret.scope_name || ret.scope_id || '',
        customer:         ret.customer_name || ret.customer_phone || '',
        performedBy:      ret.username      || ret.processed_by_username || ret.processed_by_name || '',
        items,
        totalReturnedQty,
        totalRestockedQty,
        totalNotRestocked,
        totalValue,
        status,
      }
    }))
    return enriched
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.scopeType !== 'ALL') params.append('scopeType', filters.scopeType)
      if (filters.scopeId)             params.append('scopeId',   filters.scopeId)
      if (filters.status !== 'ALL')    params.append('status',    filters.status)
      if (filters.search)              params.append('search',    filters.search)
      if (filters.from)                params.append('from',      filters.from)
      if (filters.to)                  params.append('to',        filters.to)
      const qs = params.toString() ? `?${params}` : ''

      let grouped = []
      let usedFallback = false

      // ── Try dedicated /returns/restock endpoint first ──────────────────
      try {
        const res  = await api.get(`/returns/restock${qs}`)
        const data = res.data?.data || []
        if (data.length > 0) {
          // Dedicated endpoint has data — use it
          grouped = buildFromRestockEndpoint(data)
          setSource('dedicated')
        } else {
          // Dedicated endpoint returned empty — fall through to /sales/returns
          usedFallback = true
        }
      } catch {
        // Dedicated endpoint failed (404 or error) — fall through to /sales/returns
        usedFallback = true
      }

      // ── Fallback: /sales/returns ──────────────────────────────────────
      if (usedFallback) {
        const sQs = new URLSearchParams()
        if (filters.scopeType !== 'ALL') sQs.append('scopeType', filters.scopeType)
        if (filters.scopeId)             sQs.append('scopeId',   filters.scopeId)
        const fallbackRes = await api.get(`/sales/returns${sQs.toString() ? `?${sQs}` : ''}`)
        let raw = fallbackRes.data?.data || fallbackRes.data || []
        if (!Array.isArray(raw)) raw = []

        // Client-side filtering on fallback data
        if (filters.search) {
          const q = filters.search.toLowerCase()
          raw = raw.filter(r =>
            r.invoice_no?.toLowerCase().includes(q)    ||
            r.return_no?.toLowerCase().includes(q)     ||
            r.customer_name?.toLowerCase().includes(q) ||
            (r.items || []).some(i =>
              i.name?.toLowerCase().includes(q) ||
              i.sku?.toLowerCase().includes(q)
            )
          )
        }
        if (filters.from) raw = raw.filter(r => (r.created_at || '') >= filters.from)
        if (filters.to)   raw = raw.filter(r => (r.created_at || '') <= filters.to + 'T23:59:59')

        grouped = await buildFromSalesReturns(raw)
        if (filters.status !== 'ALL') grouped = grouped.filter(r => r.status === filters.status)
        setSource('fallback')
      }

      setRows(grouped)
    } catch (err) {
      setRows([])
      setError(err?.response?.data?.message || 'Failed to load return restock data.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadData() }, [loadData])

  const setF         = (field, value) => setFilters(p => ({ ...p, [field]: value }))
  const clearFilters = () => setFilters({ scopeType: 'ALL', scopeId: '', status: 'ALL', search: '', from: '', to: '' })

  // Summary stats
  const totalReturns     = rows.length
  const totalItems       = rows.reduce((s, r) => s + (r.items?.length || 0), 0)
  const totalReturnedQty = rows.reduce((s, r) => s + r.totalReturnedQty,  0)
  const totalRestocked   = rows.reduce((s, r) => s + r.totalRestockedQty, 0)
  const totalPending     = rows.reduce((s, r) => s + r.totalNotRestocked, 0)
  const totalValue       = rows.reduce((s, r) => s + r.totalValue,        0)
  const completed        = rows.filter(r => r.status === 'COMPLETED').length
  const partial          = rows.filter(r => r.status === 'PARTIAL').length
  const pending          = rows.filter(r => r.status === 'PENDING').length

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', p: 3, width: '100%' }}>

          {/* Header */}
          <Box sx={{
            bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`,
            borderLeft: `4px solid ${accentColor}`, borderRadius: 2, p: 3, mb: 3,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2,
          }}>
            <Box>
              <Typography variant="caption" sx={{ color: accentColor, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>
                Reports / Return Restock
              </Typography>
              <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ mt: 0.5 }}>Return Restock</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Full audit of returned items — invoice, item name, qty, price, and restock status. Click any row to expand.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {source === 'fallback' && (
                <Chip label="Fallback: /sales/returns" size="small" color="warning" variant="outlined" sx={{ fontSize: '0.72rem' }} />
              )}
              <Button onClick={loadData} disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <Refresh />} variant="outlined">
                Refresh
              </Button>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Returns',        value: totalReturns,          icon: <ReturnIcon />,   color: accentColor },
              { label: 'Items',          value: totalItems,            icon: <InventoryIcon />, color: '#06b6d4' },
              { label: 'Qty Returned',   value: fmt(totalReturnedQty), icon: <ReturnIcon />,   color: '#f59e0b' },
              { label: 'Qty Restocked',  value: fmt(totalRestocked),   icon: <CheckIcon />,    color: '#10b981' },
              { label: 'Not Restocked',  value: fmt(totalPending),     icon: <WarningIcon />,  color: '#ef4444' },
              { label: 'Total Value',    value: fmt(totalValue),       icon: <InventoryIcon />, color: '#8b5cf6' },
            ].map(c => (
              <Grid item xs={6} sm={4} md={2} key={c.label}>
                <Card variant="outlined" sx={{ borderLeft: `3px solid ${c.color}`, borderRadius: 2 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
                      <Box sx={{ color: c.color, display: 'flex', fontSize: 15 }}>{c.icon}</Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.65rem', fontWeight: 600 }}>
                        {c.label}
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: c.color }}>{c.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Status chips */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
            <Chip label={`${totalReturns} Total`}     variant="outlined" />
            <Chip label={`${completed} Completed`}   color="success" variant="outlined" />
            <Chip label={`${partial} Partial`}       color="warning" variant="outlined" />
            <Chip label={`${pending} Pending`}       color="error"   variant="outlined" />
          </Box>

          {/* Filters */}
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterList sx={{ color: accentColor, fontSize: 18 }} />
                <Typography fontWeight={600} fontSize="0.875rem">Filters</Typography>
              </Box>
              <Tooltip title="Clear all filters">
                <IconButton size="small" onClick={clearFilters}><Clear fontSize="small" /></IconButton>
              </Tooltip>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Scope Type</InputLabel>
                  <Select value={filters.scopeType} onChange={(e) => setF('scopeType', e.target.value)} label="Scope Type">
                    <MenuItem value="ALL">All</MenuItem>
                    <MenuItem value="BRANCH">Branch</MenuItem>
                    <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <TextField fullWidth size="small"
                  label={filters.scopeType === 'WAREHOUSE' ? 'Warehouse ID' : filters.scopeType === 'BRANCH' ? 'Branch ID' : 'Scope ID'}
                  value={filters.scopeId} onChange={(e) => setF('scopeId', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={filters.status} onChange={(e) => setF('status', e.target.value)} label="Status">
                    <MenuItem value="ALL">All Statuses</MenuItem>
                    <MenuItem value="PENDING">Pending</MenuItem>
                    <MenuItem value="PARTIAL">Partial</MenuItem>
                    <MenuItem value="COMPLETED">Completed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <TextField fullWidth size="small" type="date" label="From"
                  value={filters.from} onChange={(e) => setF('from', e.target.value)}
                  InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <TextField fullWidth size="small" type="date" label="To"
                  value={filters.to} onChange={(e) => setF('to', e.target.value)}
                  InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <TextField fullWidth size="small" label="Search invoice / item / customer"
                  value={filters.search} onChange={(e) => setF('search', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadData()} />
              </Grid>
            </Grid>
          </Paper>

          {/* Main table */}
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50' }}>
                      <TableCell sx={{ width: 40 }} />
                      {['Date', 'Invoice #', 'Return #', 'Scope', 'Location', 'Customer',
                        'Items', 'Returned Qty', 'Restocked Qty', 'Not Restocked',
                        'Total Value', 'Status', 'Performed By'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', py: 1.2 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} align="center" sx={{ py: 6, color: 'text.disabled' }}>
                          No return records found for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : rows.map((row, i) => (
                      <ReturnRow key={`${row.id}-${i}`} row={row} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          {rows.length > 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ mt: 1.5, display: 'block', textAlign: 'right' }}>
              {rows.length} return{rows.length !== 1 ? 's' : ''} · Click any row to see per-item details
              {source === 'fallback' && ' · Data from /sales/returns (fallback mode)'}
            </Typography>
          )}

      </Box>
    </RouteGuard>
  )
}