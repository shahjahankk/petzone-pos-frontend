'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Box, Typography, Button, Card, CardContent, Grid, Select, MenuItem, FormControl,
  InputLabel, Chip, Alert, Snackbar, CircularProgress, Paper
} from '@mui/material'
import { PhoneCallback, CheckCircle, SkipNext, Replay } from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import {
  resolveQueueBranch, getQueueBranchInfo, getWaitingQueue, getQueueStatus, getQueueCounters,
  callNextTicket, updateTicketStatus, recallTicket,
} from '../../../utils/queueApi'

const STATUS_COLORS = {
  waiting: 'warning', called: 'info', serving: 'success',
}

function QueueCounterPage() {
  const [branchCtx, setBranchCtx] = useState(null)
  const [services, setServices] = useState([])
  const [counters, setCounters] = useState([])
  const [counterId, setCounterId] = useState('')
  const [queue, setQueue] = useState([])
  const [stats, setStats] = useState({ waiting: 0, in_progress: 0, completed: 0, total_today: 0 })
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [calling, setCalling] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })

  const selectedCounter = counters.find((c) => String(c.id) === String(counterId)) || null
  const serviceFilter = selectedCounter?.service_type_id || ''

  const refresh = useCallback(async () => {
    if (!branchCtx) return
    try {
      const [q, status] = await Promise.all([
        getWaitingQueue(branchCtx.orgSlug, branchCtx.branchSlug, serviceFilter || undefined),
        getQueueStatus(branchCtx.orgSlug, branchCtx.branchSlug),
      ])
      setQueue(q || [])
      const waiting = (status?.waiting_by_service || []).reduce((a, w) => a + (w.waiting_count || 0), 0)
      setStats({
        waiting,
        in_progress: (status?.now_serving || []).length,
        completed: 0,
        total_today: waiting + (status?.now_serving || []).length,
      })
      const called = (q || []).filter((t) => ['called', 'serving'].includes(t.status))
      const forStation = counterId
        ? called.filter((t) => String(t.counter_id) === String(counterId))
        : called.slice()
      forStation.sort((a, b) => new Date(b.called_at || 0) - new Date(a.called_at || 0))
      setCurrent(forStation[0] || null)
    } catch { /* silent refresh */ }
  }, [branchCtx, serviceFilter, counterId])

  useEffect(() => {
    (async () => {
      try {
        const ctx = await resolveQueueBranch()
        setBranchCtx(ctx)
        const [info, counterList] = await Promise.all([
          getQueueBranchInfo(ctx.orgSlug, ctx.branchSlug),
          getQueueCounters(ctx.orgSlug, ctx.branchSlug),
        ])
        setServices(info.services || [])
        const list = Array.isArray(counterList) ? counterList : []
        setCounters(list)
        const saved = typeof window !== 'undefined'
          ? window.localStorage.getItem(`pos-queue-counter-${ctx.orgSlug}-${ctx.branchSlug}`)
          : null
        if (saved && list.some((c) => String(c.id) === String(saved))) {
          setCounterId(String(saved))
        } else if (list.length === 1) {
          setCounterId(String(list[0].id))
        }
      } catch (err) {
        setToast({ open: true, message: err?.response?.data?.message || err.message, severity: 'error' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (branchCtx) {
      refresh()
      const id = setInterval(refresh, 5000)
      return () => clearInterval(id)
    }
  }, [branchCtx, refresh])

  const handleCounterChange = (value) => {
    setCounterId(value)
    if (branchCtx && value) {
      window.localStorage.setItem(
        `pos-queue-counter-${branchCtx.orgSlug}-${branchCtx.branchSlug}`,
        String(value)
      )
    }
  }

  const handleCallNext = async () => {
    if (!branchCtx) return
    if (counters.length && !counterId) {
      setToast({ open: true, message: 'Select OPD or Grooming station first', severity: 'warning' })
      return
    }
    setCalling(true)
    try {
      const res = await callNextTicket(branchCtx.orgSlug, branchCtx.branchSlug, {
        counter_id: counterId || null,
        service_type_id: serviceFilter || null,
      })
      if (res.data) {
        setCurrent(res.data)
        setToast({ open: true, message: `Called ${res.data.ticket_code}`, severity: 'success' })
      } else {
        setToast({ open: true, message: 'No waiting tickets', severity: 'info' })
      }
      refresh()
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || err.message, severity: 'error' })
    } finally {
      setCalling(false)
    }
  }

  const handleAction = async (status) => {
    if (!current) return
    try {
      if (status === 'recall') {
        await recallTicket(current.id)
      } else {
        await updateTicketStatus(current.id, status)
        if (['completed', 'skipped'].includes(status)) setCurrent(null)
      }
      refresh()
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'error' })
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box>
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
          PetZone Hospital
        </Typography>
        <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
          Queue Counter — {branchCtx?.branchName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          OPD stations call consultation tokens. Grooming station calls grooming tokens.
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Waiting', value: stats.waiting, color: '#f59e0b' },
            { label: 'In Progress', value: stats.in_progress, color: '#3b82f6' },
            { label: 'This Station Queue', value: queue.filter((t) => t.status === 'waiting').length, color: '#1e3a8a' },
          ].map((s) => (
            <Grid item xs={4} key={s.label}>
              <Card><CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h3" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Card sx={{ p: 2 }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Station</InputLabel>
                <Select
                  value={counterId}
                  label="Station"
                  onChange={(e) => handleCounterChange(e.target.value)}
                >
                  <MenuItem value="">Select station</MenuItem>
                  {counters.map((c) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {c.counter_label || c.name}
                      {c.service_name ? ` · ${c.service_name}` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {services.length > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                  Active services: {services.map((s) => s.name).join(' · ')}
                </Typography>
              )}

              <Button
                variant="contained" fullWidth size="large"
                startIcon={calling ? <CircularProgress size={20} color="inherit" /> : <PhoneCallback />}
                onClick={handleCallNext}
                disabled={calling}
                sx={{ mb: 2, py: 2, fontSize: 18 }}
              >
                Call Next Number
              </Button>

              {current && (
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#eff6ff' }}>
                  <Typography variant="body2" color="text.secondary">Now Calling</Typography>
                  <Typography variant="h1" fontWeight={900} color="primary">{current.ticket_code}</Typography>
                  <Typography variant="h6" sx={{ mb: 1 }}>{current.service_name}</Typography>
                  {(current.counter_label || current.counter_name) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      TV shows: {current.counter_label || current.counter_name}
                    </Typography>
                  )}
                  {current.pet_name && <Typography variant="body2">Pet: {current.pet_name}</Typography>}
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2, flexWrap: 'wrap' }}>
                    <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />} onClick={() => handleAction('serving')}>Serving</Button>
                    <Button size="small" variant="contained" startIcon={<CheckCircle />} onClick={() => handleAction('completed')}>Complete</Button>
                    <Button size="small" variant="outlined" startIcon={<Replay />} onClick={() => handleAction('recall')}>Recall</Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<SkipNext />} onClick={() => handleAction('skipped')}>Skip</Button>
                  </Box>
                </Paper>
              )}
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <Card sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Waiting Queue
                {selectedCounter ? ` — ${selectedCounter.counter_label || selectedCounter.name}` : ''}
              </Typography>
              {queue.filter((t) => t.status === 'waiting').length === 0 ? (
                <Typography color="text.secondary">No patients waiting</Typography>
              ) : (
                queue.filter((t) => t.status === 'waiting').map((t) => (
                  <Box key={t.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid #eee' }}>
                    <Box>
                      <Typography variant="h5" fontWeight={800} color="primary" component="span">{t.ticket_code}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }} component="span">{t.service_name}</Typography>
                      {t.pet_name && <Typography variant="caption" display="block">Pet: {t.pet_name}</Typography>}
                    </Box>
                    <Chip label={t.status} color={STATUS_COLORS[t.status] || 'default'} size="small" />
                  </Box>
                ))
              )}
            </Card>
          </Grid>
        </Grid>

        <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
          <Alert severity={toast.severity}>{toast.message}</Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  )
}

export default withAuth(() => (
  <RouteGuard allowedRoles={['ADMIN', 'CASHIER']}>
    <QueueCounterPage />
  </RouteGuard>
))
