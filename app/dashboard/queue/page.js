'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Box, Typography, Card, CardContent, Grid, Button, Table, TableHead, TableRow,
  TableCell, TableBody, Select, MenuItem, FormControl, InputLabel, Snackbar, Alert,
  CircularProgress, Chip
} from '@mui/material'
import { ConfirmationNumber, Tv, PhoneCallback, OpenInNew } from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import api from '../../../utils/axios'
import {
  resolveQueueBranch, getQueueStats, listQueueBranches, linkPosBranch,
} from '../../../utils/queueApi'

function QueueDashboardPage() {
  const [branchCtx, setBranchCtx] = useState(null)
  const [stats, setStats] = useState(null)
  const [qmsBranches, setQmsBranches] = useState([])
  const [posBranches, setPosBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })

  const load = useCallback(async () => {
    try {
      const ctx = await resolveQueueBranch()
      setBranchCtx(ctx)
      const s = await getQueueStats(ctx.qmsBranchId)
      setStats(s)
      const [qms, pos] = await Promise.all([
        listQueueBranches().catch(() => []),
        api.get('/branches').then((r) => r.data?.data || r.data || []).catch(() => []),
      ])
      setQmsBranches(qms)
      setPosBranches(Array.isArray(pos) ? pos : [])
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || err.message, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id) }, [load])

  const handleLink = async (qmsId, posId) => {
    try {
      await linkPosBranch(qmsId, posId)
      setToast({ open: true, message: 'Branch linked', severity: 'success' })
      load()
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'error' })
    }
  }

  if (loading) {
    return <DashboardLayout><Box sx={{ p: 8, textAlign: 'center' }}><CircularProgress /></Box></DashboardLayout>
  }

  const summary = stats?.summary || {}

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
          Clinic Queue Management
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {branchCtx?.branchName} — Live queue stats for today
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Waiting', value: summary.waiting || 0, color: '#f59e0b' },
            { label: 'In Progress', value: summary.in_progress || 0, color: '#3b82f6' },
            { label: 'Completed', value: summary.completed || 0, color: '#059669' },
            { label: 'Total Today', value: summary.total_today || 0, color: '#1e3a8a' },
          ].map((s) => (
            <Grid item xs={6} md={3} key={s.label}>
              <Card><CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h3" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <ConfirmationNumber sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>Issue Token</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Reception kiosk with thermal printer</Typography>
              <Button variant="contained" href="/queue/kiosk" startIcon={<OpenInNew />}>Open Kiosk</Button>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <PhoneCallback sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>Staff Counter</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Call next patient, complete or skip</Typography>
              <Button variant="contained" href="/queue/counter" startIcon={<OpenInNew />}>Open Counter</Button>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Tv sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>TV Display</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Waiting room screen — open on TV</Typography>
              <Button variant="outlined" href="/queue/display" target="_blank" startIcon={<OpenInNew />}>Open Display</Button>
            </Card>
          </Grid>
        </Grid>

        {stats?.by_service?.length > 0 && (
          <Card sx={{ mb: 4, p: 2 }}>
            <Typography variant="h6" gutterBottom>Today by Service</Typography>
            <Grid container spacing={1}>
              {stats.by_service.map((s) => (
                <Grid item key={s.name}>
                  <Chip label={`${s.prefix} ${s.name}: ${s.count}`} sx={{ bgcolor: `${s.color}20`, color: s.color, fontWeight: 600 }} />
                </Grid>
              ))}
            </Grid>
          </Card>
        )}

        <Card sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Link POS Branches to Queue</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Queue Branch</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Linked POS Branch</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {qmsBranches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>{b.slug}</TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>POS Branch</InputLabel>
                      <Select
                        value={b.pos_branch_id || ''}
                        label="POS Branch"
                        onChange={(e) => handleLink(b.id, e.target.value)}
                      >
                        <MenuItem value="">None</MenuItem>
                        {posBranches.map((pb) => (
                          <MenuItem key={pb.id} value={pb.id}>{pb.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast({ ...toast, open: false })}>
          <Alert severity={toast.severity}>{toast.message}</Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  )
}

export default withAuth(() => (
  <RouteGuard allowedRoles={['ADMIN', 'CASHIER']}>
    <QueueDashboardPage />
  </RouteGuard>
))
