'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Box, Paper, Typography, Grid, TextField, FormControl,
  InputLabel, Select, MenuItem, Button, Alert, Chip,
} from '@mui/material'
import { DataGrid, GridToolbar } from '@mui/x-data-grid'
import { useSelector } from 'react-redux'
import RouteGuard from '../../../../components/auth/RouteGuard'
import api from '../../../../utils/axios'
import { Refresh, FilterList, Search } from '@mui/icons-material'

// ── Column definitions ────────────────────────────────────────────────────────
const columns = [
  { field: 'date', headerName: 'Date', width: 130,
    renderCell: ({ value }) => <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>{value}</span> },
  { field: 'scopeType', headerName: 'Scope', width: 110,
    renderCell: ({ value }) => (
      <Chip label={value || '—'} size="small" sx={{
        background: value === 'BRANCH' ? 'rgba(99,102,241,0.15)' : 'rgba(20,184,166,0.15)',
        color: value === 'BRANCH' ? '#a5b4fc' : '#5eead4',
        fontSize: '0.68rem', height: 20,
      }} />
    )},
  { field: 'scopeName', headerName: 'Location', width: 180,
    renderCell: ({ value }) => <span style={{ color: '#fff', fontSize: '0.82rem' }}>{value || '—'}</span> },
  { field: 'invoiceNo', headerName: 'Invoice #', width: 130,
    renderCell: ({ value }) => <span style={{ color: '#a5b4fc', fontSize: '0.82rem', fontWeight: 600 }}>{value || '—'}</span> },
  { field: 'sku', headerName: 'SKU', width: 120,
    renderCell: ({ value }) => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{value || '—'}</span> },
  { field: 'itemName', headerName: 'Item', width: 200,
    renderCell: ({ value }) => <span style={{ color: '#fff', fontSize: '0.82rem' }}>{value || '—'}</span> },
  { field: 'returnedQty', headerName: 'Returned', width: 100, type: 'number',
    renderCell: ({ value }) => <span style={{ color: '#fbbf24', fontWeight: 700 }}>{value}</span> },
  { field: 'restockedQty', headerName: 'Restocked', width: 110, type: 'number',
    renderCell: ({ value }) => <span style={{ color: '#34d399', fontWeight: 700 }}>{value}</span> },
  { field: 'notRestockedQty', headerName: 'Not Restocked', width: 130, type: 'number',
    renderCell: ({ value }) => <span style={{ color: value > 0 ? '#f87171' : 'rgba(255,255,255,0.4)', fontWeight: value > 0 ? 700 : 400 }}>{value}</span> },
  { field: 'status', headerName: 'Status', width: 120,
    renderCell: ({ value }) => {
      const map = {
        COMPLETED: { bg: 'rgba(52,211,153,0.15)', color: '#34d399' },
        PARTIAL: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
        PENDING: { bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
      }
      const s = map[value] || { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }
      return <Chip label={value || '—'} size="small" sx={{ background: s.bg, color: s.color, fontSize: '0.68rem', height: 20 }} />
    }},
  { field: 'performedBy', headerName: 'Performed By', width: 160,
    renderCell: ({ value }) => <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>{value || '—'}</span> },
]

const inputSx = {
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(168,85,247,0.5)' },
    '&.Mui-focused fieldset': { borderColor: '#a855f7' },
  },
  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
  '& input': { color: '#fff' },
}

export default function ReturnRestockReportPage() {
  const { user } = useSelector((s) => s.auth)
  const [filters, setFilters] = useState({ scopeType: 'ALL', scopeId: '', status: 'ALL', search: '', from: '', to: '' })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.scopeType !== 'ALL') params.append('scopeType', filters.scopeType)
      if (filters.scopeId) params.append('scopeId', filters.scopeId)
      if (filters.status !== 'ALL') params.append('status', filters.status)
      if (filters.search) params.append('search', filters.search)
      if (filters.from) params.append('from', filters.from)
      if (filters.to) params.append('to', filters.to)

      const res = await api.get(`/returns/restock${params.toString() ? `?${params}` : ''}`)
      const data = res.data?.data || []
      setRows(data.map((r, idx) => ({
        id: r.id || idx + 1,
        date: r.date || r.created_at || '',
        scopeType: r.scope_type || r.scopeType || '',
        scopeName: r.scope_name || r.scopeName || '',
        invoiceNo: r.invoice_no || r.invoiceNo || '',
        sku: r.sku || '',
        itemName: r.item_name || r.itemName || '',
        returnedQty: Number(r.returned_qty ?? r.returnedQty ?? 0),
        restockedQty: Number(r.restocked_qty ?? r.restockedQty ?? 0),
        notRestockedQty: Number(r.not_restocked_qty ?? r.notRestockedQty ?? (Number(r.returned_qty ?? 0) - Number(r.restocked_qty ?? 0))),
        status: r.status || (Number(r.restocked_qty ?? 0) === 0 ? 'PENDING' : Number(r.restocked_qty ?? 0) < Number(r.returned_qty ?? 0) ? 'PARTIAL' : 'COMPLETED'),
        performedBy: r.performed_by || r.performedBy || '',
      })))
    } catch {
      setRows([])
      setError('Backend endpoint not ready. Please enable GET /api/returns/restock on the server.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadData() }, [loadData])

  const setF = (field, value) => setFilters(p => ({ ...p, [field]: value }))

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <Box sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0e0518 0%, #160a2e 50%, #0e0518 100%)',
        fontFamily: "'DM Sans', sans-serif",
        p: 3,
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

        {/* Header */}
        <Box sx={{
          background: 'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(139,92,246,0.08) 100%)',
          border: '1px solid rgba(168,85,247,0.25)',
          borderRadius: 3, p: 3, mb: 3,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Box>
            <Typography sx={{ color: '#d8b4fe', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 2, mb: 0.5 }}>
              Reports / Return Restock
            </Typography>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700 }}>Return Restock</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', mt: 0.5, fontSize: '0.875rem' }}>
              Audit returns — restocked, partial, and pending
            </Typography>
          </Box>
          <Button onClick={loadData} disabled={loading} startIcon={<Refresh />} variant="outlined"
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', '&:hover': { borderColor: '#a855f7', background: 'rgba(168,85,247,0.1)' } }}>
            Refresh
          </Button>
        </Box>

        {error && (
          <Alert severity="info" sx={{ mb: 2, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: '#d8b4fe' }}>
            {error}
          </Alert>
        )}

        {/* Filters */}
        <Paper sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, p: 2.5, mb: 3 }} elevation={0}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FilterList sx={{ color: '#a855f7', fontSize: 18 }} />
            <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem' }}>Filters</Typography>
          </Box>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel>Scope Type</InputLabel>
                <Select value={filters.scopeType} onChange={(e) => setF('scopeType', e.target.value)} label="Scope Type">
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="BRANCH">Branch</MenuItem>
                  <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" sx={inputSx}
                label={filters.scopeType === 'WAREHOUSE' ? 'Warehouse' : filters.scopeType === 'BRANCH' ? 'Branch' : 'Scope'}
                value={filters.scopeId} onChange={(e) => setF('scopeId', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small" sx={inputSx}>
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
              <TextField fullWidth size="small" type="date" label="From" value={filters.from}
                onChange={(e) => setF('from', e.target.value)} InputLabelProps={{ shrink: true }} sx={inputSx} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" type="date" label="To" value={filters.to}
                onChange={(e) => setF('to', e.target.value)} InputLabelProps={{ shrink: true }} sx={inputSx} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" label="Search SKU / Item / Invoice" value={filters.search}
                onChange={(e) => setF('search', e.target.value)} sx={inputSx}
                onKeyDown={(e) => e.key === 'Enter' && loadData()} />
            </Grid>
          </Grid>
        </Paper>

        {/* DataGrid */}
        <Paper sx={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }} elevation={0}>
          <Box sx={{
            height: 560,
            '& .MuiDataGrid-root': { border: 'none', color: '#fff', fontFamily: "'DM Sans', sans-serif" },
            '& .MuiDataGrid-columnHeader': { background: 'rgba(168,85,247,0.12)', color: '#d8b4fe', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 },
            '& .MuiDataGrid-columnSeparator': { color: 'rgba(168,85,247,0.2)' },
            '& .MuiDataGrid-row': { borderBottom: '1px solid rgba(255,255,255,0.04)' },
            '& .MuiDataGrid-row:hover': { background: 'rgba(168,85,247,0.06)' },
            '& .MuiDataGrid-cell': { borderBottom: 'none' },
            '& .MuiDataGrid-footerContainer': { background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' },
            '& .MuiDataGrid-toolbarContainer': { background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', p: 1 },
            '& .MuiButton-root': { color: '#a855f7' },
            '& .MuiTablePagination-root': { color: 'rgba(255,255,255,0.5)' },
            '& .MuiTablePagination-selectIcon': { color: 'rgba(255,255,255,0.4)' },
            '& .MuiIconButton-root': { color: 'rgba(255,255,255,0.4)' },
            '& .MuiDataGrid-noRowsOverlay': { color: 'rgba(255,255,255,0.3)' },
            '& .MuiInputBase-root': { color: '#fff' },
            '& .MuiDataGrid-selectedRowCount': { color: 'rgba(255,255,255,0.4)' },
          }}>
            <DataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              slots={{ toolbar: GridToolbar }}
              slotProps={{ toolbar: { sx: { '& .MuiButton-root': { color: '#a855f7' } } } }}
              initialState={{ pagination: { paginationModel: { page: 0, pageSize: 10 } } }}
              pageSizeOptions={[10, 25, 50]}
              disableRowSelectionOnClick
            />
          </Box>
        </Paper>
      </Box>
    </RouteGuard>
  )
}