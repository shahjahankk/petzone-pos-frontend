'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Box, Typography, Button, Card, CardContent, Grid, TextField, Alert, Snackbar,
  CircularProgress, Chip, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import { ConfirmationNumber, Print, Usb } from '@mui/icons-material'
import { useSelector } from 'react-redux'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import {
  connectThermalPrinter, getPrinterSupportMessage, isThermalPrintingSupported,
  getGrantedPrinterCount, isSystemPrinterMode, connectSystemPrinter,
} from '../../../utils/thermalPrinter'
import { resolveQueueBranch, getQueueBranchInfo, issueTicket } from '../../../utils/queueApi'
import { printQueueTicket } from '../../../utils/queueThermalPrinter'

function QueueKioskPage() {
  const { user } = useSelector((s) => s.auth)
  const [branchCtx, setBranchCtx] = useState(null)
  const [services, setServices] = useState([])
  const [selected, setSelected] = useState(null)
  const [petName, setPetName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [lastTicket, setLastTicket] = useState(null)
  const [printerReady, setPrinterReady] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ctx = await resolveQueueBranch()
      setBranchCtx(ctx)
      const info = await getQueueBranchInfo(ctx.orgSlug, ctx.branchSlug)
      setServices(info.services || [])
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || err.message, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getGrantedPrinterCount().then((n) => setPrinterReady(n > 0 || isSystemPrinterMode()))
  }, [])

  const handleConnectPrinter = async () => {
    try {
      await connectThermalPrinter()
      setPrinterReady(true)
      setToast({ open: true, message: 'Printer connected', severity: 'success' })
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'warning' })
    }
  }

  const handleUseSystemPrinter = () => {
    connectSystemPrinter()
    setPrinterReady(true)
    setToast({ open: true, message: 'System printer mode enabled', severity: 'success' })
  }

  const handleIssue = async () => {
    if (!selected || !branchCtx) return
    setIssuing(true)
    try {
      const ticket = await issueTicket(branchCtx.orgSlug, branchCtx.branchSlug, {
        service_type_id: selected.id,
        pet_name: petName.trim() || null,
        owner_name: ownerName.trim() || null,
      })
      setLastTicket(ticket)
      const printResult = await printQueueTicket(ticket)
      setToast({
        open: true,
        message: printResult.message || `Token ${ticket.ticket_code} printed`,
        severity: 'success',
      })
      setSelected(null)
      setPetName('')
      setOwnerName('')
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || err.message, severity: 'error' })
    } finally {
      setIssuing(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f0f4ff', p: 3 }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight={800} color="primary">
              PetZone Queue Kiosk
            </Typography>
            <Typography color="text.secondary">
              {branchCtx?.branchName} — {user?.username || user?.email}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!printerReady && isThermalPrintingSupported() && (
              <Button variant="outlined" startIcon={<Usb />} onClick={handleConnectPrinter} size="small">
                Connect Printer
              </Button>
            )}
            {!printerReady && (
              <Button variant="text" onClick={handleUseSystemPrinter} size="small">
                System Printer
              </Button>
            )}
            {printerReady && <Chip label="Printer Ready" color="success" size="small" />}
          </Box>
        </Box>

        {!printerReady && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {getPrinterSupportMessage()} Connect your Epson thermal printer before issuing tokens.
          </Alert>
        )}

        {!selected ? (
          <>
            <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
              Select a service to issue a queue token
            </Typography>
            <Grid container spacing={2}>
              {services.map((svc) => (
                <Grid item xs={12} sm={6} md={4} key={svc.id}>
                  <Card
                    sx={{
                      cursor: 'pointer', textAlign: 'center', p: 2,
                      border: `3px solid ${svc.color}30`,
                      '&:hover': { borderColor: svc.color, transform: 'translateY(-2px)' },
                      transition: 'all 0.2s',
                    }}
                    onClick={() => setSelected(svc)}
                  >
                    <Typography variant="h2" fontWeight={900} sx={{ color: svc.color }}>
                      {svc.prefix}
                    </Typography>
                    <Typography variant="h6">{svc.name}</Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        ) : (
          <Card sx={{ maxWidth: 480, mx: 'auto', p: 2 }}>
            <CardContent>
              <Typography variant="h6" color="primary" gutterBottom>
                {selected.name}
              </Typography>
              <TextField fullWidth label="Pet Name (optional)" value={petName} onChange={(e) => setPetName(e.target.value)} sx={{ mb: 2, mt: 1 }} />
              <TextField fullWidth label="Owner Name (optional)" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} sx={{ mb: 3 }} />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="outlined" onClick={() => setSelected(null)} fullWidth>Back</Button>
                <Button
                  variant="contained" fullWidth size="large"
                  startIcon={issuing ? <CircularProgress size={20} color="inherit" /> : <Print />}
                  onClick={handleIssue}
                  disabled={issuing}
                >
                  Print Token
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {lastTicket && (
          <Alert severity="success" sx={{ mt: 3 }} icon={<ConfirmationNumber />}>
            Last issued: <strong>{lastTicket.ticket_code}</strong> — {lastTicket.service_name}
            {lastTicket.waiting_ahead > 0 && ` (${lastTicket.waiting_ahead} ahead)`}
          </Alert>
        )}
      </Box>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  )
}

export default withAuth(() => (
  <RouteGuard allowedRoles={['ADMIN', 'CASHIER']}>
    <QueueKioskPage />
  </RouteGuard>
))
