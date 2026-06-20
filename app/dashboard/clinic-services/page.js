'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Card, CardContent, Button, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select,
  MenuItem, IconButton, Tooltip, Snackbar, Alert, CircularProgress, Tabs, Tab
} from '@mui/material'
import { Add, Edit, Delete, Refresh, MedicalServices } from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import api from '../../../utils/axios'

function ClinicServicesPage() {
  const [tab, setTab] = useState(0)
  const [categories, setCategories] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [catDialog, setCatDialog] = useState(false)
  const [svcDialog, setSvcDialog] = useState(false)
  const [editingCat, setEditingCat] = useState(null)
  const [editingSvc, setEditingSvc] = useState(null)
  const [catForm, setCatForm] = useState({ name: '', description: '', status: 'ACTIVE', sortOrder: 0 })
  const [svcForm, setSvcForm] = useState({
    name: '', categoryId: '', description: '', defaultPrice: 0, code: '', status: 'ACTIVE', sortOrder: 0
  })
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [catRes, svcRes] = await Promise.all([
        api.get('/clinic-services/categories'),
        api.get('/clinic-services'),
      ])
      setCategories(catRes.data?.data || [])
      setServices(svcRes.data?.data || [])
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || 'Failed to load', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const openCatCreate = () => {
    setEditingCat(null)
    setCatForm({ name: '', description: '', status: 'ACTIVE', sortOrder: 0 })
    setCatDialog(true)
  }

  const openCatEdit = (c) => {
    setEditingCat(c)
    setCatForm({ name: c.name, description: c.description || '', status: c.status, sortOrder: c.sortOrder || 0 })
    setCatDialog(true)
  }

  const saveCategory = async () => {
    if (!catForm.name.trim()) return
    setSaving(true)
    try {
      if (editingCat) {
        await api.put(`/clinic-services/categories/${editingCat.id}`, catForm)
      } else {
        await api.post('/clinic-services/categories', catForm)
      }
      setCatDialog(false)
      loadAll()
      setToast({ open: true, message: 'Category saved', severity: 'success' })
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || 'Save failed', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const deleteCategory = async (id) => {
    if (!window.confirm('Delete this category? Services will be uncategorized.')) return
    try {
      await api.delete(`/clinic-services/categories/${id}`)
      loadAll()
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || 'Delete failed', severity: 'error' })
    }
  }

  const openSvcCreate = () => {
    setEditingSvc(null)
    setSvcForm({ name: '', categoryId: categories[0]?.id || '', description: '', defaultPrice: 0, code: '', status: 'ACTIVE', sortOrder: 0 })
    setSvcDialog(true)
  }

  const openSvcEdit = (s) => {
    setEditingSvc(s)
    setSvcForm({
      name: s.name,
      categoryId: s.categoryId || '',
      description: s.description || '',
      defaultPrice: s.defaultPrice,
      code: s.code || '',
      status: s.status,
      sortOrder: s.sortOrder || 0,
    })
    setSvcDialog(true)
  }

  const saveService = async () => {
    if (!svcForm.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...svcForm,
        categoryId: svcForm.categoryId ? Number(svcForm.categoryId) : null,
        defaultPrice: parseFloat(svcForm.defaultPrice) || 0,
        sortOrder: parseInt(svcForm.sortOrder, 10) || 0,
      }
      if (editingSvc) {
        await api.put(`/clinic-services/${editingSvc.id}`, payload)
      } else {
        await api.post('/clinic-services', payload)
      }
      setSvcDialog(false)
      loadAll()
      setToast({ open: true, message: 'Service saved', severity: 'success' })
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || 'Save failed', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const deleteService = async (id) => {
    if (!window.confirm('Delete this clinic service?')) return
    try {
      await api.delete(`/clinic-services/${id}`)
      loadAll()
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || 'Delete failed', severity: 'error' })
    }
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MedicalServices color="primary" />
            <Typography variant="h4" fontWeight={700}>Clinic Services</Typography>
          </Box>
          <Button startIcon={<Refresh />} onClick={loadAll} disabled={loading}>Refresh</Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Admin manages pet clinic service categories and default prices. Cashiers add these on POS bills (custom price allowed; default shows under price).
        </Typography>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Services" />
          <Tab label="Categories" />
        </Tabs>

        {tab === 0 && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<Add />} onClick={openSvcCreate}>Add Service</Button>
              </Box>
              {loading ? <CircularProgress /> : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell align="right">Default Price</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {services.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.categoryName || '—'}</TableCell>
                        <TableCell>{s.code || '—'}</TableCell>
                        <TableCell align="right">{Number(s.defaultPrice).toFixed(2)}</TableCell>
                        <TableCell>{s.status}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => openSvcEdit(s)}><Edit /></IconButton>
                          <IconButton size="small" color="error" onClick={() => deleteService(s.id)}><Delete /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 1 && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<Add />} onClick={openCatCreate}>Add Category</Button>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.description || '—'}</TableCell>
                      <TableCell>{c.status}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openCatEdit(c)}><Edit /></IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteCategory(c.id)}><Delete /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={catDialog} onClose={() => setCatDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingCat ? 'Edit Category' : 'New Category'}</DialogTitle>
          <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Name *" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} fullWidth />
            <TextField label="Description" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} fullWidth multiline rows={2} />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={catForm.status} label="Status" onChange={(e) => setCatForm({ ...catForm, status: e.target.value })}>
                <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                <MenuItem value="INACTIVE">INACTIVE</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCatDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={saveCategory} disabled={saving}>Save</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={svcDialog} onClose={() => setSvcDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingSvc ? 'Edit Service' : 'New Service'}</DialogTitle>
          <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Service Name *" value={svcForm.name} onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select value={svcForm.categoryId} label="Category" onChange={(e) => setSvcForm({ ...svcForm, categoryId: e.target.value })}>
                <MenuItem value="">None</MenuItem>
                {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Default Price *" type="number" inputProps={{ min: 0, step: 0.01 }}
              value={svcForm.defaultPrice} onChange={(e) => setSvcForm({ ...svcForm, defaultPrice: e.target.value })} fullWidth />
            <TextField label="Code (optional)" value={svcForm.code} onChange={(e) => setSvcForm({ ...svcForm, code: e.target.value })} fullWidth helperText="Leave blank — system can generate CLINIC-id on bill" />
            <TextField label="Description" value={svcForm.description} onChange={(e) => setSvcForm({ ...svcForm, description: e.target.value })} fullWidth multiline rows={2} />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={svcForm.status} label="Status" onChange={(e) => setSvcForm({ ...svcForm, status: e.target.value })}>
                <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                <MenuItem value="INACTIVE">INACTIVE</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSvcDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={saveService} disabled={saving}>Save</Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast({ ...toast, open: false })}>
          <Alert severity={toast.severity}>{toast.message}</Alert>
        </Snackbar>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(ClinicServicesPage)
