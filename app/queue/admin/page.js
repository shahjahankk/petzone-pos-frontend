'use client'

/**
 * Opens QMS Admin full-page with SSO (same pattern as LabelPress / OPD redirect).
 */

import { useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import api from '../../../utils/axios'
import { config } from '../../../config/environment'

const QMS_HOME = (
  (config.QMS_API_URL || 'https://queue-management.petzone.pk/api').replace(/\/api\/?$/, '') ||
  'https://queue-management.petzone.pk'
).replace(/\/$/, '')

function QueueAdminRedirectPage() {
  const [targetUrl, setTargetUrl] = useState('')
  const [status, setStatus] = useState('Signing you in to Queue Management…')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function go() {
      setBusy(true)
      setError('')
      try {
        const res = await api.post('/qms/sso', { redirectPath: '/admin' })
        const ssoUrl = res.data?.ssoUrl
        if (!ssoUrl) {
          throw new Error(res.data?.message || 'No SSO URL returned from multipos')
        }
        if (cancelled) return
        setTargetUrl(ssoUrl)
        setStatus('Opening Queue Management…')
        window.location.replace(ssoUrl)
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Could not sign in to Queue Management'
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
        background: 'linear-gradient(135deg, #eef4ff 0%, #f8fbff 50%, #e8f7f0 100%)',
      }}
    >
      <Stack spacing={2} alignItems="center" sx={{ maxWidth: 520, textAlign: 'center' }}>
        {busy ? <CircularProgress /> : null}
        <Typography variant="h6" fontWeight={800}>
          {status}
        </Typography>
        <Typography color="text.secondary">
          Queue Management opens in its own screen — signed in with your PetZone login.
        </Typography>
        {error ? (
          <Alert severity="error" sx={{ width: '100%', textAlign: 'left' }}>
            {error}
            <Typography variant="body2" sx={{ mt: 1 }}>
              Set multipos QMS_API_URL / QMS_APP_URL / QMS_SSO_SECRET and matching
              SSO_SHARED_SECRET on Queue Management, then Restart both.
            </Typography>
          </Alert>
        ) : null}
        <Button
          variant="contained"
          size="large"
          endIcon={<OpenInNewIcon />}
          href={targetUrl || `${QMS_HOME}/admin`}
          component="a"
          sx={{ borderRadius: 2, mt: 1 }}
        >
          {targetUrl ? 'Open Queue Admin (SSO)' : 'Open Queue Admin (password login)'}
        </Button>
      </Stack>
    </Box>
  )
}

export default withAuth(() => (
  <RouteGuard allowedRoles={['ADMIN', 'CASHIER']}>
    <QueueAdminRedirectPage />
  </RouteGuard>
))
