'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Box, Typography, Button, Alert, Snackbar, CircularProgress, Chip, Stack,
  Paper, Divider, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import {
  ConfirmationNumber, Print, Usb, Cable, PrintOutlined, Settings,
  RestartAlt, Pin,
} from '@mui/icons-material'
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
import {
  resolveQueueBranch,
  issueToken,
  issueServiceTicket,
  getQueueBranchInfo,
  hasQueueAdminSession,
  clearQueueAdminSession,
  queueAdminLogin,
  getQueueSequence,
  setQueueNextNumber,
  resetQueueToday,
} from '../../../utils/queueApi'
import { printQueueTicket } from '../../../utils/queueThermalPrinter'
import { PETZONE_LOGO_PNG, PETZONE_LOGO_SVG } from '../../../utils/brandAssets'
import { config } from '../../../config/environment'

function transportLabel(transport) {
  if (transport === 'usb') return 'USB Ready (silent)'
  if (transport === 'serial') return 'Serial/COM Ready (silent)'
  if (transport === 'system') return 'System Print (dialog)'
  return 'Printer Ready'
}

function isConsultationService(service) {
  if (!service) return true
  return (
    /consult|opd/i.test(String(service.name || '')) ||
    String(service.prefix || '').toUpperCase() === 'C'
  )
}

function isGroomingService(service) {
  if (!service) return false
  return (
    /groom/i.test(String(service.name || '')) ||
    String(service.prefix || '').toUpperCase() === 'G'
  )
}

/** Always show Consultation + Grooming on the kiosk, even if API is slow/partial. */
function buildKioskServiceButtons(apiServices) {
  const list = Array.isArray(apiServices) ? apiServices : []
  const consult = list.find(isConsultationService) || null
  const grooming = list.find(isGroomingService) || null
  return [
    {
      key: 'consultation',
      name: consult?.name || 'General Consultation',
      prefix: consult?.prefix || 'C',
      color: consult?.color || '#1E3A8A',
      id: consult?.id ?? null,
      kind: 'consultation',
    },
    {
      key: 'grooming',
      name: grooming?.name || 'Grooming',
      prefix: grooming?.prefix || 'G',
      color: grooming?.color || '#D97706',
      id: grooming?.id ?? null,
      kind: 'grooming',
    },
  ]
}

function QueueKioskPage() {
  const { user } = useSelector((s) => s.auth)
  const [branchCtx, setBranchCtx] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [lastTicket, setLastTicket] = useState(null)
  const [printerReady, setPrinterReady] = useState(false)
  const [transport, setTransport] = useState(null)
  const [preferBrowser, setPreferBrowser] = useState(false)
  const [usbBlocked, setUsbBlocked] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [queueAdminReady, setQueueAdminReady] = useState(false)
  const [sequence, setSequence] = useState(null)
  const [nextNumber, setNextNumber] = useState('')
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [adminCredentials, setAdminCredentials] = useState({
    email: 'admin@petzone.com',
    password: '',
  })

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
      try {
        const info = await getQueueBranchInfo(ctx.orgSlug, ctx.branchSlug)
        setServices(Array.isArray(info?.services) ? info.services : [])
      } catch {
        setServices([])
      }
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

  const loadSequence = async () => {
    if (!branchCtx?.qmsBranchId) {
      throw new Error('This POS branch is not linked to a queue branch')
    }
    const data = await getQueueSequence(branchCtx.qmsBranchId)
    setSequence(data)
    setNextNumber(String(data.next_number))
    setQueueAdminReady(true)
    return data
  }

  const openNumberSettings = async () => {
    setSettingsOpen(true)
    if (!hasQueueAdminSession()) {
      setQueueAdminReady(false)
      return
    }
    setSettingsBusy(true)
    try {
      await loadSequence()
    } catch (err) {
      clearQueueAdminSession()
      setQueueAdminReady(false)
      setToast({
        open: true,
        message: 'Queue admin session expired. Sign in again.',
        severity: 'warning',
      })
    } finally {
      setSettingsBusy(false)
    }
  }

  const handleQueueAdminLogin = async () => {
    setSettingsBusy(true)
    try {
      await queueAdminLogin(adminCredentials.email, adminCredentials.password)
      await loadSequence()
      setAdminCredentials((prev) => ({ ...prev, password: '' }))
      setToast({ open: true, message: 'Queue number controls unlocked', severity: 'success' })
    } catch (err) {
      clearQueueAdminSession()
      setQueueAdminReady(false)
      setToast({ open: true, message: err.message, severity: 'error' })
    } finally {
      setSettingsBusy(false)
    }
  }

  const handleSetNextNumber = async () => {
    const value = Number(nextNumber)
    if (!Number.isInteger(value) || value < 1) {
      setToast({ open: true, message: 'Enter a whole number (1 or higher)', severity: 'warning' })
      return
    }
    setSettingsBusy(true)
    try {
      const result = await setQueueNextNumber(branchCtx.qmsBranchId, value)
      await loadSequence()
      setToast({ open: true, message: result.message, severity: 'success' })
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'error' })
    } finally {
      setSettingsBusy(false)
    }
  }

  const handleResetToday = async () => {
    const confirmation = window.prompt(
      `This deletes today's tokens for ALL categories (Consultation + Grooming) at ${branchCtx?.branchName || 'this branch'}.\nType RESET to continue:`
    )
    if (confirmation !== 'RESET') return

    setSettingsBusy(true)
    try {
      const result = await resetQueueToday(branchCtx.qmsBranchId)
      setLastTicket(null)
      await loadSequence()
      setToast({ open: true, message: result.message, severity: 'success' })
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'error' })
    } finally {
      setSettingsBusy(false)
    }
  }

  const handlePrintToken = async (service) => {
    if (!branchCtx) return
    setIssuing(true)
    try {
      let ticket
      if (!service || service.kind === 'consultation' || isConsultationService(service)) {
        ticket = await issueToken(branchCtx.orgSlug, branchCtx.branchSlug)
      } else {
        let serviceId = service.id
        if (!serviceId) {
          const info = await getQueueBranchInfo(branchCtx.orgSlug, branchCtx.branchSlug)
          const found = (info?.services || []).find(isGroomingService)
          serviceId = found?.id
          if (found) {
            setServices(info.services || [])
          }
        }
        if (!serviceId) {
          throw new Error('Grooming service is not configured on this branch yet. Deploy/restart QMS and refresh.')
        }
        ticket = await issueServiceTicket(branchCtx.orgSlug, branchCtx.branchSlug, serviceId)
      }

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

  const serviceButtons = buildKioskServiceButtons(services)

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: { xs: 2, md: 4 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #eef4ff 0%, #f8fbff 50%, #e8f7f0 100%)',
      }}
    >
      <Box sx={{ maxWidth: 760, width: '100%', textAlign: 'center' }}>
        <Paper
          elevation={8}
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 5,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
        <Box
          component="img"
          src={PETZONE_LOGO_PNG}
          alt="PetZone"
          onError={(e) => { e.currentTarget.src = PETZONE_LOGO_SVG }}
          sx={{ height: { xs: 56, md: 72 }, mb: 2, objectFit: 'contain', maxWidth: '80%' }}
        />

        <Typography variant="h4" fontWeight={900} color="primary" gutterBottom>
          Queue Token Station
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3, fontSize: 17 }}>
          {branchCtx?.branchName || 'PetZone Clinic'} — Consultation &amp; Grooming
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {usbBlocked && (
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
            USB is blocked by the Windows printer driver. For <strong>silent print</strong>, click
            {' '}<strong>Serial / COM</strong>. If Epson is not listed, install WinUSB with Zadig.
            System Print always shows the Chrome dialog.
          </Alert>
        )}

        <Stack spacing={1.5} sx={{ mb: 3 }} alignItems="center">
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
          <Paper
            variant="outlined"
            sx={{ mb: 3, p: 2, bgcolor: 'rgba(37, 99, 235, 0.04)', borderColor: 'primary.light' }}
          >
            <Typography variant="overline" color="text.secondary">Latest token</Typography>
            <Typography variant="h1" fontWeight={900} color="primary" lineHeight={1}>
              {lastTicket.ticket_code}
            </Typography>
          </Paper>
        )}

        <Stack spacing={1.5} sx={{ mb: 1 }}>
          {serviceButtons.map((service) => (
            <Button
              key={service.key}
              variant="contained"
              size="large"
              fullWidth
              sx={{
                py: 2.4,
                fontSize: 20,
                borderRadius: 3,
                fontWeight: 800,
                bgcolor: service.color,
                color: '#fff',
                '&:hover': { bgcolor: service.color, filter: 'brightness(0.92)' },
              }}
              startIcon={issuing ? <CircularProgress size={22} color="inherit" /> : <Print />}
              onClick={() => handlePrintToken(service)}
              disabled={issuing || !branchCtx}
            >
              {service.name}
            </Button>
          ))}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Choose Consultation or Grooming, then the token prints automatically.
        </Typography>

        <Button
          variant="outlined"
          color="secondary"
          startIcon={<Settings />}
          onClick={openNumberSettings}
          sx={{ mt: 2, borderRadius: 2 }}
        >
          Number Settings
        </Button>

        {lastTicket && (
          <Alert severity="success" sx={{ mt: 3 }} icon={<ConfirmationNumber />}>
            Last token: <strong>{lastTicket.ticket_code}</strong>
          </Alert>
        )}
        </Paper>
      </Box>

      <Snackbar open={toast.open} autoHideDuration={5000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>{toast.message}</Alert>
      </Snackbar>

      <Dialog
        open={settingsOpen}
        onClose={() => !settingsBusy && setSettingsOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800 }}>
          <Pin color="primary" /> Queue Number Settings
        </DialogTitle>
        <DialogContent dividers>
          {!queueAdminReady ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="info">
                Sign in with a QMS administrator account to change or reset token numbers.
              </Alert>
              <TextField
                label="QMS Admin Email"
                type="email"
                value={adminCredentials.email}
                onChange={(e) => setAdminCredentials((prev) => ({ ...prev, email: e.target.value }))}
                fullWidth
              />
              <TextField
                label="QMS Admin Password"
                type="password"
                value={adminCredentials.password}
                onChange={(e) => setAdminCredentials((prev) => ({ ...prev, password: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQueueAdminLogin()
                }}
                fullWidth
              />
            </Stack>
          ) : (
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>
                  {sequence?.branch_name || branchCtx?.branchName}
                </Typography>
                <Typography color="text.secondary">
                  {sequence?.service_name || 'All categories (shared)'} · {sequence?.date_key}
                </Typography>
              </Box>

              <Stack direction="row" spacing={2}>
                <Paper variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Last issued</Typography>
                  <Typography variant="h4" fontWeight={900}>{sequence?.highest_issued || 0}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Next token</Typography>
                  <Typography variant="h4" fontWeight={900} color="primary">
                    {sequence?.next_number || 1}
                  </Typography>
                </Paper>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  label="Set next token number"
                  type="number"
                  value={nextNumber}
                  onChange={(e) => setNextNumber(e.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                  fullWidth
                />
                <Button
                  variant="contained"
                  onClick={handleSetNextNumber}
                  disabled={settingsBusy}
                  sx={{ minWidth: 120 }}
                >
                  Set Next
                </Button>
              </Stack>

              <Alert severity="warning">
                Reset removes today&apos;s tokens for all categories and starts again from 1.
              </Alert>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RestartAlt />}
                onClick={handleResetToday}
                disabled={settingsBusy}
              >
                Reset Today to 1
              </Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {queueAdminReady && (
            <Button
              color="inherit"
              onClick={() => {
                clearQueueAdminSession()
                setQueueAdminReady(false)
                setSequence(null)
              }}
            >
              Lock Controls
            </Button>
          )}
          <Button onClick={() => setSettingsOpen(false)} disabled={settingsBusy}>Close</Button>
          {!queueAdminReady && (
            <Button
              variant="contained"
              onClick={handleQueueAdminLogin}
              disabled={settingsBusy || !adminCredentials.email || !adminCredentials.password}
            >
              {settingsBusy ? 'Signing in…' : 'Unlock'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default withAuth(() => (
  <RouteGuard allowedRoles={['ADMIN', 'CASHIER']}>
    <QueueKioskPage />
  </RouteGuard>
))
