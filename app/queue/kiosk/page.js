'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Box, Typography, Button, Alert, Snackbar, CircularProgress, Chip, Stack,
} from '@mui/material'
import { ConfirmationNumber, Print, Usb, Cable, PrintOutlined } from '@mui/icons-material'
import { useSelector } from 'react-redux'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import {
  connectThermalPrinter,
  connectUsbPrinter,
  connectSerialPrinter,
  connectSystemPrinter,
  getPrinterSupportMessage,
  isThermalPrintingSupported,
  isWebUsbSupported,
  isWebSerialSupported,
  getGrantedPrinterCount,
  isSystemPrinterMode,
  getActivePrinterTransport,
  restoreCachedPrinter,
} from '../../../utils/thermalPrinter'
import { resolveQueueBranch, issueToken } from '../../../utils/queueApi'
import { printQueueTicket } from '../../../utils/queueThermalPrinter'
import { PETZONE_LOGO_PNG, PETZONE_LOGO_SVG } from '../../../utils/brandAssets'
import { config } from '../../../config/environment'

function transportLabel(transport) {
  if (transport === 'usb') return 'USB Ready'
  if (transport === 'serial') return 'Serial/COM Ready'
  if (transport === 'system') return 'System Printer'
  return 'Printer Ready'
}

function QueueKioskPage() {
  const { user } = useSelector((s) => s.auth)
  const [branchCtx, setBranchCtx] = useState(null)
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [lastTicket, setLastTicket] = useState(null)
  const [printerReady, setPrinterReady] = useState(false)
  const [transport, setTransport] = useState(null)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })

  const refreshPrinter = useCallback(async () => {
    try {
      await restoreCachedPrinter()
    } catch (e) {
      /* ignore */
    }
    const n = await getGrantedPrinterCount()
    const modeSystem = isSystemPrinterMode()
    const active = getActivePrinterTransport()
    setPrinterReady(n > 0 || modeSystem)
    setTransport(modeSystem ? 'system' : active)
  }, [])

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
  useEffect(() => { refreshPrinter() }, [refreshPrinter])

  const handleConnectUsb = async () => {
    try {
      await connectUsbPrinter()
      await refreshPrinter()
      setToast({ open: true, message: 'USB printer connected', severity: 'success' })
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'warning' })
    }
  }

  const handleConnectSerial = async () => {
    try {
      await connectSerialPrinter()
      await refreshPrinter()
      setToast({ open: true, message: 'Serial/COM printer connected', severity: 'success' })
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'warning' })
    }
  }

  const handleConnectAuto = async () => {
    try {
      const result = await connectThermalPrinter()
      await refreshPrinter()
      setToast({
        open: true,
        message: result.transport === 'serial' ? 'Serial/COM printer connected' : 'USB printer connected',
        severity: 'success',
      })
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'warning' })
    }
  }

  const handleUseSystemPrinter = () => {
    connectSystemPrinter()
    setPrinterReady(true)
    setTransport('system')
    setToast({ open: true, message: 'System printer mode enabled', severity: 'success' })
  }

  const handlePrintToken = async () => {
    if (!branchCtx) return
    setIssuing(true)
    try {
      const ticket = await issueToken(branchCtx.orgSlug, branchCtx.branchSlug)
      setLastTicket(ticket)
      const printResult = await printQueueTicket(ticket, { allowPortRequest: !printerReady })
      setToast({
        open: true,
        message: printResult.message || `Token ${ticket.ticket_code} printed`,
        severity: printResult.success ? 'success' : 'error',
      })
      if (printResult.success) {
        await refreshPrinter()
      }
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
      <Box sx={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <Box
          component="img"
          src={PETZONE_LOGO_PNG}
          alt="PetZone"
          onError={(e) => { e.currentTarget.src = PETZONE_LOGO_SVG }}
          sx={{ height: 56, mb: 2, objectFit: 'contain' }}
        />

        <Typography variant="h5" fontWeight={800} color="primary" gutterBottom>
          Queue Token
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {branchCtx?.branchName || 'PetZone Clinic'}
        </Typography>

        <Stack spacing={1} sx={{ mb: 2 }} alignItems="center">
          {printerReady ? (
            <Chip label={transportLabel(transport)} color="success" size="small" />
          ) : (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
              {isWebUsbSupported() && (
                <Button variant="outlined" size="small" startIcon={<Usb />} onClick={handleConnectUsb}>
                  USB
                </Button>
              )}
              {isWebSerialSupported() && (
                <Button variant="outlined" size="small" startIcon={<Cable />} onClick={handleConnectSerial}>
                  Serial / COM
                </Button>
              )}
              {isThermalPrintingSupported() && (
                <Button variant="outlined" size="small" onClick={handleConnectAuto}>
                  Auto Connect
                </Button>
              )}
              <Button variant="text" size="small" startIcon={<PrintOutlined />} onClick={handleUseSystemPrinter}>
                System Printer
              </Button>
            </Stack>
          )}
        </Stack>

        {!printerReady && (
          <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
            {getPrinterSupportMessage()}
          </Alert>
        )}

        {printerReady && transport && transport !== 'system' && (
          <Button size="small" sx={{ mb: 2 }} onClick={handleUseSystemPrinter}>
            Switch to System Printer
          </Button>
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
