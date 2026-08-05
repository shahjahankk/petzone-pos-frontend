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
  hasDirectPrinterPaired,
  getActivePrinterTransport,
  restoreCachedPrinter,
  setPrinterMode,
  PRINTER_MODE_DIRECT,
} from '../../../utils/thermalPrinter'
import { resolveQueueBranch, issueToken } from '../../../utils/queueApi'
import { printQueueTicket } from '../../../utils/queueThermalPrinter'
import { PETZONE_LOGO_PNG, PETZONE_LOGO_SVG } from '../../../utils/brandAssets'
import { config } from '../../../config/environment'

function transportLabel(transport) {
  if (transport === 'usb') return 'USB Ready (silent)'
  if (transport === 'serial') return 'Serial/COM Ready (silent)'
  if (transport === 'system') return 'System Print (dialog)'
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
  const [preferBrowser, setPreferBrowser] = useState(false)
  const [usbBlocked, setUsbBlocked] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })

  const refreshPrinter = useCallback(async () => {
    try {
      await restoreCachedPrinter()
    } catch (e) {
      /* ignore */
    }
    const paired = await hasDirectPrinterPaired()
    if (paired) {
      setPrinterMode(PRINTER_MODE_DIRECT)
      setPreferBrowser(false)
      setUsbBlocked(false)
      setPrinterReady(true)
      setTransport(getActivePrinterTransport())
      return
    }
    setPrinterReady(preferBrowser)
    setTransport(preferBrowser ? 'system' : null)
  }, [preferBrowser])

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

  const noteUsbBlock = (msg) => {
    if (/blocked by Windows|WinUSB|Zadig|access|denied|claim/i.test(msg || '')) {
      setUsbBlocked(true)
    }
  }

  const handleConnectUsb = async () => {
    try {
      await connectUsbPrinter()
      setPreferBrowser(false)
      setUsbBlocked(false)
      await refreshPrinter()
      setToast({ open: true, message: 'USB connected — silent token print', severity: 'success' })
    } catch (err) {
      noteUsbBlock(err.message)
      setPreferBrowser(false)
      setToast({ open: true, message: err.message, severity: 'warning' })
      await refreshPrinter()
    }
  }

  const handleConnectSerial = async () => {
    try {
      await connectSerialPrinter()
      setPreferBrowser(false)
      setUsbBlocked(false)
      await refreshPrinter()
      setToast({ open: true, message: 'Serial/COM connected — silent token print', severity: 'success' })
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'warning' })
      await refreshPrinter()
    }
  }

  const handleConnectAuto = async () => {
    try {
      const result = await connectThermalPrinter()
      setPreferBrowser(false)
      setUsbBlocked(false)
      await refreshPrinter()
      setToast({
        open: true,
        message: result.transport === 'serial' ? 'Serial/COM connected' : 'USB connected',
        severity: 'success',
      })
    } catch (err) {
      noteUsbBlock(err.message)
      setPreferBrowser(false)
      setToast({ open: true, message: err.message, severity: 'warning' })
      await refreshPrinter()
    }
  }

  const handleUseSystemPrinter = () => {
    connectSystemPrinter()
    setPreferBrowser(true)
    setPrinterReady(true)
    setTransport('system')
    setToast({
      open: true,
      message: 'System Print opens Chrome dialog (not silent). Prefer Serial/COM if USB is blocked.',
      severity: 'warning',
    })
  }

  const handlePrintToken = async () => {
    if (!branchCtx) return
    setIssuing(true)
    try {
      const ticket = await issueToken(branchCtx.orgSlug, branchCtx.branchSlug)
      setLastTicket(ticket)
      const printResult = await printQueueTicket(ticket, {
        allowPortRequest: !printerReady || preferBrowser,
        preferBrowser,
      })
      setToast({
        open: true,
        message: printResult.message || `Token ${ticket.ticket_code}`,
        severity: printResult.success ? 'success' : 'error',
      })
      if (!printResult.success) noteUsbBlock(printResult.message)
      if (printResult.success && !printResult.usedFallback) {
        await refreshPrinter()
      }
    } catch (err) {
      noteUsbBlock(err.message)
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
      <Box sx={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
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
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {branchCtx?.branchName || 'PetZone Clinic'}
        </Typography>

        {usbBlocked && (
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
            USB is blocked by the Windows printer driver. For <strong>silent print</strong>, click
            {' '}<strong>Serial / COM</strong>. If Epson is not listed, install WinUSB with Zadig.
            System Print always shows the Chrome dialog.
          </Alert>
        )}

        <Stack spacing={1} sx={{ mb: 2 }} alignItems="center">
          {printerReady && transport && transport !== 'system' ? (
            <Chip label={transportLabel(transport)} color="success" size="small" />
          ) : (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
              {isWebUsbSupported() && (
                <Button variant="outlined" size="small" startIcon={<Usb />} onClick={handleConnectUsb}>
                  USB
                </Button>
              )}
              {isWebSerialSupported() && (
                <Button
                  variant={usbBlocked ? 'contained' : 'outlined'}
                  color={usbBlocked ? 'success' : 'primary'}
                  size="small"
                  startIcon={<Cable />}
                  onClick={handleConnectSerial}
                >
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
            {usbBlocked
              ? 'Next step: click Serial / COM and pick the Epson if it appears.'
              : getPrinterSupportMessage()}
          </Alert>
        )}

        {printerReady && transport === 'system' && (
          <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
            System Print mode uses the Chrome dialog. Connect Serial/COM or USB for silent printing.
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

      <Snackbar open={toast.open} autoHideDuration={5000} onClose={() => setToast({ ...toast, open: false })}>
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
