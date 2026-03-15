'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTheme } from '@mui/material/styles'
import {
  Box, Paper, Typography, Grid, TextField, FormControl,
  InputLabel, Select, MenuItem, Button, Alert, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, CircularProgress, IconButton, Tooltip,
} from '@mui/material'
import { useSelector } from 'react-redux'
import RouteGuard from '../../../../components/auth/RouteGuard'
import api from '../../../../utils/axios'
import { Refresh, FilterList, Search, Clear } from '@mui/icons-material'

const STATUS_COLORS = {
  COMPLETED: 'success',
  PARTIAL:   'warning',
  PENDING:   'error',
}

export default function ReturnRestockReportPage() {
  const theme   = useTheme()
  const isDark  = theme.palette.mode === 'dark'
  const { user } = useSelector((s) => s.auth)

  const [filters, setFilters] = useState({
    scopeType: 'ALL', scopeId: '', status: 'ALL', search: '', from: '', to: '',
  })
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

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

      const res  = await api.get(`/returns/restock${params.toString() ? `?${params}` : ''}`)
      const data = res.data?.data || []

      setRows(data.map((r, idx) => ({
        id:              r.id            || idx + 1,
        date:            r.date          || r.created_at || '',
        scopeType:       r.scope_type    || r.scopeType  || '',
        scopeName:       r.scope_name    || r.scopeName  || '',
        invoiceNo:       r.invoice_no    || r.invoiceNo  || '',
        sku:             r.sku           || '',
        itemName:        r.item_name     || r.itemName   || '',
        returnedQty:     Number(r.returned_qty    ?? r.returnedQty    ?? 0),
        restockedQty:    Number(r.restocked_qty   ?? r.restockedQty   ?? 0),
        notRestockedQty: Number(r.not_restocked_qty ?? r.notRestockedQty ?? (Number(r.returned_qty ?? 0) - Number(r.restocked_qty ?? 0))),
        status: r.status || (
          Number(r.restocked_qty ?? 0) === 0 ? 'PENDING' :
          Number(r.restocked_qty ?? 0) < Number(r.returned_qty ?? 0) ? 'PARTIAL' :
          'COMPLETED'
        ),
        performedBy: r.performed_by || r.performedBy || '',
      })))
    } catch (err) {
      setRows([])
      setError(
        err?.response?.status === 404
          ? 'Backend endpoint not ready. Please enable GET /api/returns/restock on the server.'
          : err?.response?.data?.message || 'Failed to load restock data.'
      )
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadData() }, [loadData])

  const setF = (field, value) => setFilters(p => ({ ...p, [field]: value }))

  const clearFilters = () => setFilters({ scopeType: 'ALL', scopeId: '', status: 'ALL', search: '', from: '', to: '' })

  const accentColor = theme.palette.mode === 'dark' ? '#a855f7' : '#7c3aed'

  // Summary stats
  const total       = rows.length
  const completed   = rows.filter(r => r.status === 'COMPLETED').length
  const partial     = rows.filter(r => r.status === 'PARTIAL').length
  const pending     = rows.filter(r => r.status === 'PENDING').length

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>

        {/* Header */}
        <Box sx={{
          bgcolor: 'background.paper',
          border: `1px solid ${theme.palette.divider}`,
          borderLeft: `4px solid ${accentColor}`,
          borderRadius: 2, p: 3, mb: 3,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Box>
            <Typography variant="caption" sx={{ color: accentColor, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>
              Reports / Return Restock
            </Typography>
            <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ mt: 0.5 }}>
              Return Restock
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Audit returns — restocked, partial, and pending
            </Typography>
          </Box>
          <Button onClick={loadData} disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : <Refresh />} variant="outlined">
            Refresh
          </Button>
        </Box>

        {/* Error */}
        {error && (
          <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* Summary chips */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: `${total} Total`,      color: 'default'  },
            { label: `${completed} Done`,   color: 'success'  },
            { label: `${partial} Partial`,  color: 'warning'  },
            { label: `${pending} Pending`,  color: 'error'    },
          ].map(c => (
            <Chip key={c.label} label={c.label} color={c.color} variant="outlined" />
          ))}
        </Box>

        {/* Filters */}
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterList sx={{ color: accentColor, fontSize: 18 }} />
              <Typography fontWeight={600} fontSize="0.875rem">Filters</Typography>
            </Box>
            <Tooltip title="Clear filters">
              <IconButton size="small" onClick={clearFilters}><Clear fontSize="small" /></IconButton>
            </Tooltip>
          </Box>
          <Grid container spacing={2} alignItems="flex-end">
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
                value={filters.scopeId}
                onChange={(e) => setF('scopeId', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={filters.status} onChange={(e) => setF('status', e.target.value)} label="Status">
                  <MenuItem value="ALL">All</MenuItem>
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
              <TextField fullWidth size="small" label="Search SKU / Item / Invoice"
                value={filters.search} onChange={(e) => setF('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()} />
            </Grid>
          </Grid>
        </Paper>

        {/* Table */}
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'grey.50' }}>
                    {['Date', 'Scope', 'Location', 'Invoice #', 'SKU', 'Item', 'Returned', 'Restocked', 'Not Restocked', 'Status', 'Performed By'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center" sx={{ py: 6, color: 'text.disabled' }}>
                        {error ? 'Backend endpoint not available yet.' : 'No restock records found.'}
                      </TableCell>
                    </TableRow>
                  ) : rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'text.secondary' }}>
                        {row.date ? new Date(row.date).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip label={row.scopeType || '—'} size="small" variant="outlined"
                          color={row.scopeType === 'BRANCH' ? 'primary' : row.scopeType === 'WAREHOUSE' ? 'secondary' : 'default'}
                          sx={{ fontSize: '0.68rem', height: 20 }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem' }}>{row.scopeName || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'primary.main' }}>{row.invoiceNo || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'text.secondary' }}>{row.sku || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.82rem' }}>{row.itemName || '—'}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'warning.main' }}>{row.returnedQty}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'success.main' }}>{row.restockedQty}</TableCell>
                      <TableCell sx={{ fontWeight: row.notRestockedQty > 0 ? 700 : 400, color: row.notRestockedQty > 0 ? 'error.main' : 'text.disabled' }}>
                        {row.notRestockedQty}
                      </TableCell>
                      <TableCell>
                        <Chip label={row.status || '—'} size="small"
                          color={STATUS_COLORS[row.status] || 'default'} variant="outlined"
                          sx={{ fontSize: '0.68rem', height: 20 }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{row.performedBy || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

      </Box>
    </RouteGuard>
  )
}