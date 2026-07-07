'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Box, Typography, Button, Alert, Snackbar, CircularProgress, Chip,
} from '@mui/material'
import { ConfirmationNumber, Print, Usb } from '@mui/icons-material'
import { useSelector } from 'react-redux'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import {
  connectThermalPrinter, getPrinterSupportMessage, isThermalPrintingSupported,
  getGrantedPrinterCount, isSystemPrinterMode, connectSystemPrinter,
} from '../../../utils/thermalPrinter'
import { resolveQueueBranch, issueToken } from '../../../utils/queueApi'
import { printQueueTicket } from '../../../utils/queueThermalPrinter'
import { config } from '../../../config/environment'

function QueueKioskPage() {
  const { user } = useSelector((s) => s.auth)
  const [branchCtx, setBranchCtx] = useState(null)
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [lastTicket, setLastTicket] = useState(null)
  const [printerReady, setPrinterReady] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const posBranchId = user?.branchId || user?.branch_id
      const ctx = await resolveQueueBranch(posBranchId).catch(() => ({
        orgSlug: config.QMS_ORG_SLUG,
        branchSlug: config.QMS_BRANCH_SLUG,
        branchName: 'PetZone Clinic',
      }))
      setBranchCtx(ctx)
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [user])

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

  const handlePrintToken = async () => {
    if (!branchCtx) return
    setIssuing(true)
    try {
      const ticket = await issueToken(branchCtx.orgSlug, branchCtx.branchSlug)
      setLastTicket(ticket)
      const printResult = await printQueueTicket(ticket)
      setToast({
        open: true,
        message: printResult.message || `Token ${ticket.ticket_code} printed`,
        severity: 'success',
      })
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#f0f4ff', p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <Box component="img" src="/petzonelogo.svg" alt="PetZone" sx={{ height: 56, mb: 2 }} />

        <Typography variant="h5" fontWeight={800} color="primary" gutterBottom>
          Queue Token
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {branchCtx?.branchName || 'PetZone Clinic'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 2 }}>
          {!printerReady && isThermalPrintingSupported() && (
            <Button variant="outlined" size="small" startIcon={<Usb />} onClick={handleConnectPrinter}>
              Connect Printer
            </Button>
          )}
          {!printerReady && (
            <Button variant="text" size="small" onClick={handleUseSystemPrinter}>System Printer</Button>
          )}
          {printerReady && <Chip label="Printer Ready" color="success" size="small" />}
        </Box>

        {!printerReady && (
          <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
            {getPrinterSupportMessage()}
          </Alert>
        )}

        {lastTicket && (
          <Typography variant="h2" fontWeight={900} color="primary" sx={{ mb: 2 }}>
            {lastTicket.ticket_code}
          </Typography>
        )}

        <Button
          variant="contained"
          size="large"
          fullWidth
          sx={{ py: 3, fontSize: 22, borderRadius: 3 }}
          startIcon={issuing ? <CircularProgress size={24} color="inherit" /> : <Print />}
          onClick={handlePrintToken}
          disabled={issuing}
        >
          Print Token
        </Button>

        {lastTicket && (
          <Alert severity="success" sx={{ mt: 3 }} icon={<ConfirmationNumber />}>
            Last token: <strong>{lastTicket.ticket_code}</strong>
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
