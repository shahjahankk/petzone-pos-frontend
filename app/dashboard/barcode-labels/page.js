'use client'

/**
 * Opens LabelPress full-page with SSO (own design), like Queue OPD redirect.
 */

import { useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import api from '../../../utils/axios'
import { config } from '../../../config/environment'

const FALLBACK_APP_URL = (
  config.BARCODE_APP_URL ||
  process.env.NEXT_PUBLIC_BARCODE_APP_URL ||
  'https://barcode-printer.petzone.pk'
).replace(/\/$/, '')

function BarcodeLabelsRedirectPage() {
  const [targetUrl, setTargetUrl] = useState('')
  const [status, setStatus] = useState('Signing you in to LabelPress…')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function go() {
      setBusy(true)
      setError('')
      try {
        const res = await api.post('/barcode/sso')
        const ssoUrl = res.data?.ssoUrl
        if (!ssoUrl) {
          throw new Error(res.data?.message || 'No SSO URL returned from multipos')
        }
        if (cancelled) return
        setTargetUrl(ssoUrl)
        setStatus('Opening LabelPress…')
        window.location.replace(ssoUrl)
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Could not sign in to LabelPress'
        if (!cancelled) {
          setError(msg)
          setStatus('SSO failed')
          setBusy(false)
        }
      }
    }

    go()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        background: 'linear-gradient(135deg, #ecfdf5 0%, #f8fafc 50%, #e0f2fe 100%)',
      }}
    >
      <Stack spacing={2} alignItems="center" sx={{ maxWidth: 520, textAlign: 'center' }}>
        {busy ? <CircularProgress /> : null}
        <Typography variant="h6" fontWeight={800}>
          {status}
        </Typography>
        <Typography color="text.secondary">
          Barcode labels open in LabelPress with its own screen — not inside the POS dashboard.
        </Typography>
        {error ? (
          <Alert severity="error" sx={{ width: '100%', textAlign: 'left' }}>
            {error}
            <Typography variant="body2" sx={{ mt: 1 }}>
              Check multipos env: BARCODE_API_URL, BARCODE_APP_URL, BARCODE_SSO_SECRET.
              On LabelPress cPanel set SSO_SHARED_SECRET to the same value, then Restart both apps.
            </Typography>
          </Alert>
        ) : null}
        <Button
          variant="contained"
          size="large"
          endIcon={<OpenInNewIcon />}
          href={targetUrl || FALLBACK_APP_URL}
          component="a"
          sx={{ borderRadius: 2, mt: 1 }}
        >
          {targetUrl ? 'Open LabelPress (SSO)' : 'Open LabelPress (password login)'}
        </Button>
      </Stack>
    </Box>
  )
}

export default withAuth(() => (
  <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER']}>
    <BarcodeLabelsRedirectPage />
  </RouteGuard>
))
