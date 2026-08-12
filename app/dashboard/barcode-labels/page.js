'use client'

/**
 * Opens LabelPress full-page (own design), same pattern as Queue OPD redirect.
 * Menu uses newWindow so it opens in a new tab without POS sidebar.
 */

import { useEffect, useState } from 'react'
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
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
  const [targetUrl, setTargetUrl] = useState(FALLBACK_APP_URL)
  const [status, setStatus] = useState('Opening LabelPress…')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function go() {
      let url = FALLBACK_APP_URL

      try {
        const res = await api.post('/barcode/sso')
        const ssoUrl = res.data?.ssoUrl
        if (ssoUrl) {
          url = ssoUrl
          if (!cancelled) setStatus('Signing you in to LabelPress…')
        } else if (!cancelled) {
          setStatus('Opening LabelPress…')
        }
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'SSO unavailable — opening LabelPress login'
        if (!cancelled) {
          setError(msg)
          setStatus('Opening LabelPress…')
        }
      }

      if (!cancelled) {
        setTargetUrl(url)
        window.location.replace(url)
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
      <Stack spacing={2} alignItems="center" sx={{ maxWidth: 480, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" fontWeight={800}>
          {status}
        </Typography>
        <Typography color="text.secondary">
          Barcode labels open in LabelPress with its own screen — not inside the POS dashboard.
        </Typography>
        {error ? (
          <Typography variant="body2" color="warning.main">
            {error}
          </Typography>
        ) : null}
        <Button
          variant="contained"
          size="large"
          endIcon={<OpenInNewIcon />}
          href={targetUrl}
          component="a"
          sx={{ borderRadius: 2, mt: 1 }}
        >
          Open LabelPress
        </Button>
        <Button variant="text" href={FALLBACK_APP_URL} component="a">
          {FALLBACK_APP_URL}
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
