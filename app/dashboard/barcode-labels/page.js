'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import api from '../../../utils/axios'

const FALLBACK_APP_URL = process.env.NEXT_PUBLIC_BARCODE_APP_URL || ''

export default function BarcodeLabelsPage() {
  const [ssoUrl, setSsoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const mintSso = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/barcode/sso')
      const url = res.data?.ssoUrl
      if (!url) throw new Error('No SSO URL returned')
      setSsoUrl(url)
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Could not open barcode service'
      setError(msg)
      if (FALLBACK_APP_URL) setSsoUrl(FALLBACK_APP_URL)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    mintSso()
  }, [mintSso])

  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 480 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Barcode Labels
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Uses your PetZone login via SSO — no extra barcode password when opened from here.
              Standalone URL still asks for login.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={mintSso}
              disabled={loading}
            >
              Refresh login
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<OpenInNewIcon />}
              href={ssoUrl || FALLBACK_APP_URL || undefined}
              target="_blank"
              rel="noopener noreferrer"
              disabled={!ssoUrl && !FALLBACK_APP_URL}
            >
              Open standalone
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {error}
            {FALLBACK_APP_URL ? ' Opening without SSO if possible.' : ''}
          </Alert>
        )}

        {loading && !ssoUrl ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : ssoUrl || FALLBACK_APP_URL ? (
          <Box
            component="iframe"
            title="LabelPress"
            src={ssoUrl || FALLBACK_APP_URL}
            sx={{
              flex: 1,
              width: '100%',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: '#fff',
            }}
          />
        ) : (
          <Alert severity="error">
            Set NEXT_PUBLIC_BARCODE_APP_URL and configure BARCODE_API_URL /
            BARCODE_SSO_SECRET on the POS backend.
          </Alert>
        )}
      </Box>
    </DashboardLayout>
  )
}
