'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Paper,
} from '@mui/material'
import {
  DeleteForever as DeleteForeverIcon,
  RestoreFromTrash as RestoreIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  DeleteOutline as TrashIcon,
} from '@mui/icons-material'
import withAuth from '../../../../components/auth/withAuth'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../components/auth/RouteGuard'
import ConfirmationDialog from '../../../../components/crud/ConfirmationDialog'
import api from '../../../../utils/axios'
import { formatDisplayDateTime } from '../../../../utils/displayDates'

const ENTITY_LABELS = {
  sale: 'Sale',
  inventory_item: 'Inventory Item',
  purchase_order: 'Purchase Order',
  customer: 'Customer',
  retailer: 'Retailer',
  transfer: 'Transfer',
  financial_voucher: 'Financial Voucher',
  company: 'Company',
  inventory_category: 'Category',
  salesperson: 'Salesperson',
  user: 'User',
  branch: 'Branch',
  warehouse: 'Warehouse',
  pos: 'POS Terminal',
  hardware_device: 'Hardware Device',
  billing: 'Billing',
  credit_debit_transaction: 'Credit/Debit',
  ledger: 'Ledger Account',
  ledger_entry: 'Ledger Entry',
  clinic_service: 'Clinic Service',
  clinic_service_category: 'Clinic Category',
}

function TrashPage() {
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({ total: 0, by_type: {}, expiring_soon: 0 })
  const [entityTypes, setEntityTypes] = useState(Object.keys(ENTITY_LABELS))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [entityType, setEntityType] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [total, setTotal] = useState(0)
  const [confirm, setConfirm] = useState({ open: false, action: null, row: null })
  const [busyId, setBusyId] = useState(null)

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/trash/stats')
      setStats(res.data?.data || { total: 0, by_type: {}, expiring_soon: 0 })
    } catch (_) {
      /* ignore */
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/trash', {
        params: {
          entityType: entityType || undefined,
          search: search || undefined,
          page: page + 1,
          limit: rowsPerPage,
        },
      })
      const data = res.data?.data || {}
      setItems(data.items || [])
      setTotal(data.total || 0)
      if (Array.isArray(data.entity_types) && data.entity_types.length) {
        setEntityTypes(data.entity_types)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load trash')
    } finally {
      setLoading(false)
    }
  }, [entityType, search, page, rowsPerPage])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    loadList()
  }, [loadList])

  const handleSearch = () => {
    setPage(0)
    setSearch(searchInput.trim())
  }

  const openConfirm = (action, row) => setConfirm({ open: true, action, row })
  const closeConfirm = () => setConfirm({ open: false, action: null, row: null })

  const runAction = async () => {
    const { action, row } = confirm
    if (!row) return
    setBusyId(row.id)
    setSuccess(null)
    setError(null)
    try {
      if (action === 'restore') {
        await api.post(`/trash/${row.id}/restore`)
        setSuccess(`Restored: ${row.display_name || row.entity_type}`)
      } else {
        await api.delete(`/trash/${row.id}`)
        setSuccess(`Permanently deleted: ${row.display_name || row.entity_type}`)
      }
      closeConfirm()
      await Promise.all([loadList(), loadStats()])
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action}`)
      closeConfirm()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <TrashIcon color="primary" />
            <Typography variant="h5" fontWeight={600}>
              Trash
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Refresh">
              <IconButton onClick={() => { loadList(); loadStats() }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Soft-deleted records stay here for 6 months. Restore them, or permanently delete.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">Total in trash</Typography>
                <Typography variant="h4">{stats.total}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">Expiring in 30 days</Typography>
                <Typography variant="h4" color="warning.main">{stats.expiring_soon}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">Types</Typography>
                <Typography variant="h4">{Object.keys(stats.by_type || {}).length}</Typography>
              </CardContent>
            </Card>
          </Stack>

          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

          <Paper sx={{ p: 2, mb: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type"
                  value={entityType}
                  onChange={(e) => { setEntityType(e.target.value); setPage(0) }}
                >
                  <MenuItem value="">All types</MenuItem>
                  {entityTypes.map((t) => (
                    <MenuItem key={t} value={t}>
                      {ENTITY_LABELS[t] || t}
                      {stats.by_type?.[t] != null ? ` (${stats.by_type[t]})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                placeholder="Search name, phone, invoice…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                sx={{ flex: 1 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={handleSearch}>
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>
          </Paper>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Name / Details</TableCell>
                  <TableCell>Deleted at</TableCell>
                  <TableCell>Expires at</TableCell>
                  <TableCell>Days left</TableCell>
                  <TableCell>Deleted by</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">Trash is empty</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Chip
                          size="small"
                          label={ENTITY_LABELS[row.entity_type] || row.entity_type}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {row.display_name || `#${row.entity_id}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID {row.entity_id}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDisplayDateTime(row.deleted_at)}</TableCell>
                      <TableCell>{formatDisplayDateTime(row.expires_at)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={row.days_remaining <= 30 ? 'warning' : 'default'}
                          label={`${row.days_remaining}d`}
                        />
                      </TableCell>
                      <TableCell>{row.deleted_by_username || row.deleted_by || '—'}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Restore">
                          <span>
                            <IconButton
                              color="primary"
                              disabled={busyId === row.id}
                              onClick={() => openConfirm('restore', row)}
                            >
                              <RestoreIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete forever">
                          <span>
                            <IconButton
                              color="error"
                              disabled={busyId === row.id}
                              onClick={() => openConfirm('permanent', row)}
                            >
                              <DeleteForeverIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10))
                setPage(0)
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </TableContainer>
        </Box>

        <ConfirmationDialog
          open={confirm.open}
          title={confirm.action === 'restore' ? 'Restore record?' : 'Permanently delete?'}
          message={
            confirm.action === 'restore'
              ? `Restore "${confirm.row?.display_name || confirm.row?.entity_type}" back into the system?`
              : `Permanently delete "${confirm.row?.display_name || confirm.row?.entity_type}"? This cannot be undone.`
          }
          onConfirm={runAction}
          onClose={closeConfirm}
          confirmText={confirm.action === 'restore' ? 'Restore' : 'Delete forever'}
          severity={confirm.action === 'restore' ? 'info' : 'error'}
        />
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(TrashPage)
