'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, Paper, Snackbar, Stack, TextField, Typography,
} from '@mui/material'
import { ConfirmationNumber, LockOpen, Print, RestartAlt, Settings } from '@mui/icons-material'
import { useSelector } from 'react-redux'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import {
  clearQueueAdminSession,
  getQueueSequence,
  hasQueueAdminSession,
  queueAdminLogin,
  resetQueueToday,
  resolveQueueBranch,
  setQueueNextNumber,
} from '../../../utils/queueApi'

function QueueDashboardPage() {
  const { user } = useSelector((state) => state.auth)
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN'
  const [branch, setBranch] = useState(null)
  const [sequence, setSequence] = useState(null)
  const [nextNumber, setNextNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [credentials, setCredentials] = useState({ email: 'admin@petzone.com', password: '' })
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })

  const loadSequence = useCallback(async (branchContext) => {
    if (!branchContext?.qmsBranchId) throw new Error('POS branch is not linked to QMS')
    const data = await getQueueSequence(branchContext.qmsBranchId)
    setSequence(data)
    setNextNumber(String(data.next_number))
    return data
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const posBranchId = user?.branchId || user?.branch_id
        const context = await resolveQueueBranch(posBranchId)
        setBranch(context)
        if (isAdmin && hasQueueAdminSession()) {
          try {
            await loadSequence(context)
          } catch {
            clearQueueAdminSession()
          }
        }
      } catch (err) {
        setToast({ open: true, message: err.message, severity: 'error' })
      } finally {
        setLoading(false)
      }
    })()
  }, [isAdmin, loadSequence, user])

  const unlockControls = async () => {
    setBusy(true)
    try {
      await queueAdminLogin(credentials.email, credentials.password)
      await loadSequence(branch)
      setCredentials((previous) => ({ ...previous, password: '' }))
      setLoginOpen(false)
      setToast({ open: true, message: 'Queue number controls unlocked', severity: 'success' })
    } catch (err) {
      clearQueueAdminSession()
      setToast({ open: true, message: err.message, severity: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const openControls = async () => {
    if (!hasQueueAdminSession()) {
      setLoginOpen(true)
      return
    }
    setBusy(true)
    try {
      await loadSequence(branch)
    } catch {
      clearQueueAdminSession()
      setLoginOpen(true)
    } finally {
      setBusy(false)
    }
  }

  const saveNextNumber = async () => {
    const value = Number(nextNumber)
    if (!Number.isInteger(value) || value < 1) {
      setToast({ open: true, message: 'Enter a whole number (1 or higher)', severity: 'warning' })
      return
    }
    setBusy(true)
    try {
      const result = await setQueueNextNumber(branch.qmsBranchId, value)
      await loadSequence(branch)
      setToast({ open: true, message: result.message, severity: 'success' })
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const resetToday = async () => {
    const typed = window.prompt(
      `This deletes today's consultation tokens for ${branch?.branchName || 'this branch'}.\nType RESET to continue:`
    )
    if (typed !== 'RESET') return
    setBusy(true)
    try {
      const result = await resetQueueToday(branch.qmsBranchId)
      await loadSequence(branch)
      setToast({ open: true, message: result.message, severity: 'success' })
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={900} color="primary" gutterBottom>
            Clinic Queue Control
          </Typography>
          <Typography color="text.secondary">
            Issue queue tokens and control today&apos;s starting number for {branch?.branchName || 'your clinic'}.
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} md={5}>
              <Card sx={{ height: '100%', borderRadius: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 5 }}>
                  <ConfirmationNumber sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h5" fontWeight={800} gutterBottom>Token Printer</Typography>
                  <Typography color="text.secondary" sx={{ mb: 3 }}>
                    Issue and silently print the next queue token.
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    href="/queue/kiosk"
                    startIcon={<Print />}
                    sx={{ py: 1.5, px: 4, borderRadius: 2 }}
                  >
                    Open Token Station
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={7}>
              <Card sx={{ height: '100%', borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="h5" fontWeight={800}>Number Settings</Typography>
                      <Typography variant="body2" color="text.secondary">General Consultation · Today</Typography>
                    </Box>
                    <Settings color="primary" />
                  </Stack>

                  {!isAdmin ? (
                    <Alert severity="info">Only POS administrators can change queue numbers.</Alert>
                  ) : !sequence ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary" sx={{ mb: 2 }}>
                        Unlock with your QMS administrator account.
                      </Typography>
                      <Button variant="outlined" startIcon={<LockOpen />} onClick={openControls}>
                        Unlock Controls
                      </Button>
                    </Box>
                  ) : (
                    <Stack spacing={2.5}>
                      <Stack direction="row" spacing={2}>
                        <Paper variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Last issued</Typography>
                          <Typography variant="h3" fontWeight={900}>{sequence.highest_issued || 0}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Next token</Typography>
                          <Typography variant="h3" fontWeight={900} color="primary">
                            {sequence.next_number}
                          </Typography>
                        </Paper>
                      </Stack>

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <TextField
                          label="Set next number"
                          type="number"
                          value={nextNumber}
                          onChange={(event) => setNextNumber(event.target.value)}
                          inputProps={{ min: 1, step: 1 }}
                          fullWidth
                        />
                        <Button variant="contained" onClick={saveNextNumber} disabled={busy} sx={{ minWidth: 130 }}>
                          Set Next
                        </Button>
                      </Stack>

                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<RestartAlt />}
                        onClick={resetToday}
                        disabled={busy}
                      >
                        Reset Today to 1
                      </Button>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>

      <Dialog open={loginOpen} onClose={() => !busy && setLoginOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle fontWeight={800}>Unlock Queue Controls</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="QMS Admin Email"
              type="email"
              value={credentials.email}
              onChange={(event) => setCredentials((previous) => ({ ...previous, email: event.target.value }))}
              fullWidth
            />
            <TextField
              label="QMS Admin Password"
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials((previous) => ({ ...previous, password: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') unlockControls()
              }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoginOpen(false)} disabled={busy}>Cancel</Button>
          <Button
            variant="contained"
            onClick={unlockControls}
            disabled={busy || !credentials.email || !credentials.password}
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={5000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>
          {toast.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  )
}

export default withAuth(() => (
  <RouteGuard allowedRoles={['ADMIN', 'CASHIER']}>
    <QueueDashboardPage />
  </RouteGuard>
))
