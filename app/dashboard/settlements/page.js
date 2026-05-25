'use client'
import AppDateField from '../../../components/date/AppDateField'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, MenuItem, Paper, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { Delete, Edit, Visibility } from '@mui/icons-material'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import SettlementFormDialog from '../../../components/settlements/SettlementFormDialog'
import BiltyFormDialog from '../../../components/settlements/BiltyFormDialog'
import {
  createBilty, createSettlement, deleteBilty, deleteSettlement, fetchBilties, fetchSettlements, updateBilty, updateSettlement,
} from '../../store/slices/settlementSlice'

function fmtLedgerCell(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = parseFloat(v)
  return Number.isFinite(n) ? n.toFixed(2) : '—'
}

function SettlementsPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((s) => s.auth)
  const { settlements, bilties } = useSelector((s) => s.settlement)
  const [tab, setTab] = useState(0)
  const [filters, setFilters] = useState({ startDate: '', endDate: '', customerName: '', customerPhone: '', paymentMethod: '', scopeType: '', scopeId: '' })
  const [openSettlement, setOpenSettlement] = useState(false)
  const [openBilty, setOpenBilty] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewItem, setViewItem] = useState(null)
  const [prefilledCustomer, setPrefilledCustomer] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const phone = params.get('phone')
    const name = params.get('name')
    const retailerId = params.get('retailerId')

    if (phone || name || retailerId) {
      // Auto-open the create settlement dialog with customer pre-filled
      setOpenSettlement(true)
      setPrefilledCustomer({
        phone: phone || '',
        name: name || '',
        retailerId: retailerId ? parseInt(retailerId, 10) : null
      })
    }
  }, [])

  const roleScope = useMemo(() => {
    if (user?.role === 'CASHIER') return { scopeType: 'BRANCH', scopeId: user.branchId }
    if (user?.role === 'WAREHOUSE_KEEPER') return { scopeType: 'WAREHOUSE', scopeId: user.warehouseId }
    return { scopeType: filters.scopeType || '', scopeId: filters.scopeId || '' }
  }, [user, filters.scopeType, filters.scopeId])

  const load = useCallback(() => {
    dispatch(fetchSettlements({ ...filters, ...roleScope, page: 1, limit: 50 }))
    dispatch(fetchBilties({ ...filters, ...roleScope, page: 1, limit: 50 }))
  }, [dispatch, filters, roleScope])
  useEffect(() => { load() }, [load])

  const onSaveSettlement = async (payload) => {
    if (editing?.id) await dispatch(updateSettlement({ id: editing.id, data: payload })).unwrap()
    else await dispatch(createSettlement(payload)).unwrap()
    setEditing(null)
    load()
  }
  const onSaveBilty = async (payload) => {
    if (editing?.id) await dispatch(updateBilty({ id: editing.id, data: payload })).unwrap()
    else await dispatch(createBilty(payload)).unwrap()
    setEditing(null)
    load()
  }

  const rows = tab === 0 ? settlements.data : bilties.data
  const isAdmin = user?.role === 'ADMIN'

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" sx={{ mb: 2 }}>Settlements & Bilty</Typography>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
              {isAdmin && (
                <>
                  <Grid item xs={12} md={2}>
                    <TextField select fullWidth label="Scope Type" value={filters.scopeType} onChange={(e) => setFilters({ ...filters, scopeType: e.target.value })}>
                      <MenuItem value="">ALL</MenuItem><MenuItem value="BRANCH">BRANCH</MenuItem><MenuItem value="WAREHOUSE">WAREHOUSE</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2}><TextField fullWidth label="Scope Id" value={filters.scopeId} onChange={(e) => setFilters({ ...filters, scopeId: e.target.value })} /></Grid>
                </>
              )}
              <Grid item xs={12} md={2}><AppDateField label="Start Date" value={filters.startDate} onChange={(v) => setFilters({ ...filters, startDate: v })} /></Grid>
              <Grid item xs={12} md={2}><AppDateField label="End Date" value={filters.endDate} onChange={(v) => setFilters({ ...filters, endDate: v })} /></Grid>
              <Grid item xs={12} md={2}><TextField fullWidth label="Customer Name" value={filters.customerName} onChange={(e) => setFilters({ ...filters, customerName: e.target.value })} /></Grid>
              <Grid item xs={12} md={2}><TextField fullWidth label="Customer Phone" value={filters.customerPhone} onChange={(e) => setFilters({ ...filters, customerPhone: e.target.value })} /></Grid>
              <Grid item xs={12} md={2}><TextField fullWidth label="Payment Method" value={filters.paymentMethod} onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })} /></Grid>
              <Grid item xs={12} md={2}><Button fullWidth variant="contained" onClick={load}>Apply</Button></Grid>
            </Grid>
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Tabs value={tab} onChange={(e, v) => setTab(v)}>
              <Tab label="Settlements" />
              <Tab label="Bilty / Transport" />
            </Tabs>
            <Button variant="contained" onClick={() => tab === 0 ? setOpenSettlement(true) : setOpenBilty(true)}>
              {tab === 0 ? 'Create Settlement' : 'Create Bilty'}
            </Button>
          </Box>

          {(settlements.error || bilties.error) && <Alert severity="error" sx={{ mb: 1 }}>{settlements.error || bilties.error}</Alert>}

          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell><TableCell>Date</TableCell><TableCell>Customer</TableCell><TableCell>Phone</TableCell><TableCell>Scope</TableCell>
                  <TableCell>{tab === 0 ? 'Amount Paid' : 'Total Amount'}</TableCell>
                  {tab === 1 && <TableCell>Items</TableCell>}
                  <TableCell>Old Balance</TableCell><TableCell>New Balance</TableCell><TableCell>Notes</TableCell><TableCell>Created By</TableCell><TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.invoice_no}</TableCell>
                    <TableCell>{String(row.sale_date || row.created_at || '').substring(0, 10)}</TableCell>
                    <TableCell>{row.customer_name}</TableCell>
                    <TableCell>{row.customer_phone}</TableCell>
                    <TableCell><Chip size="small" label={`${row.scope_type}:${row.scope_id}`} /></TableCell>
                    <TableCell>{tab === 0 ? row.payment_amount : row.total}</TableCell>
                    {tab === 1 && <TableCell>{row.items?.length || 0}</TableCell>}
                    <TableCell>{fmtLedgerCell(row.old_balance)}</TableCell>
                    <TableCell>{fmtLedgerCell(row.running_balance)}</TableCell>
                    <TableCell>{row.notes}</TableCell>
                    <TableCell>{row.created_by || row.user_id}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => setViewItem(row)}><Visibility fontSize="small" /></IconButton>
                      {isAdmin && <IconButton size="small" onClick={() => { setEditing(row); tab === 0 ? setOpenSettlement(true) : setOpenBilty(true) }}><Edit fontSize="small" /></IconButton>}
                      {isAdmin && <IconButton size="small" onClick={async () => { if (tab === 0) await dispatch(deleteSettlement(row.id)); else await dispatch(deleteBilty(row.id)); load() }}><Delete fontSize="small" /></IconButton>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <SettlementFormDialog
            open={openSettlement}
            onClose={() => { setOpenSettlement(false); setEditing(null); setPrefilledCustomer(null) }}
            onSave={onSaveSettlement}
            settlement={editing}
            scopeType={roleScope.scopeType}
            scopeId={roleScope.scopeId}
            userRole={user?.role}
            prefilledCustomer={prefilledCustomer}
          />
          <BiltyFormDialog
            open={openBilty}
            onClose={() => { setOpenBilty(false); setEditing(null) }}
            onSave={onSaveBilty}
            bilty={editing}
            scopeType={roleScope.scopeType}
            scopeId={roleScope.scopeId}
            userRole={user?.role}
          />

          <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth="md" fullWidth>
            <DialogTitle>View {tab === 0 ? 'Settlement' : 'Bilty'}</DialogTitle>
            <DialogContent>
              {viewItem && (
                <Box>
                  <Typography>Invoice: {viewItem.invoice_no}</Typography>
                  <Typography>Customer: {viewItem.customer_name} ({viewItem.customer_phone})</Typography>
                  <Typography>Old: {fmtLedgerCell(viewItem.old_balance)} | New: {fmtLedgerCell(viewItem.running_balance)}</Typography>
                  {tab === 1 && (viewItem.items || []).map((item) => (
                    <Typography key={item.id}>{item.description} - {item.quantity} x {item.amount} = {item.total}</Typography>
                  ))}
                </Box>
              )}
            </DialogContent>
            <DialogActions><Button onClick={() => setViewItem(null)}>Close</Button></DialogActions>
          </Dialog>
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(SettlementsPage)
