'use client'

/**
 * Opens QMS OPD counter with POS unlock (skips branch PIN).
 */

import { useEffect, useState } from 'react'
import { Box, CircularProgress, Typography, Button, Stack, Alert } from '@mui/material'
import { OpenInNew } from '@mui/icons-material'
import { useSelector } from 'react-redux'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import { resolveQueueBranch } from '../../../utils/queueApi'
import { config } from '../../../config/environment'
import api from '../../../utils/axios'

const QMS_HOME = 'https://queue-management.petzone.pk/'

function qmsOrigin() {
  try {
    const apiUrl = (config.QMS_API_URL || QMS_HOME).replace(/\/api\/?$/, '')
    return apiUrl || QMS_HOME.replace(/\/$/, '')
  } catch {
    return QMS_HOME.replace(/\/$/, '')
  }
}

function QueueOpdRedirectPage() {
  const { user } = useSelector((s) => s.auth)
  const [targetUrl, setTargetUrl] = useState(QMS_HOME)
  const [status, setStatus] = useState('Opening OPD…')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function go() {
      const origin = qmsOrigin()
      let url = `${origin}/`

      try {
        const posBranchId = user?.branchId || user?.branch_id || null
        const ctx = await resolveQueueBranch(posBranchId)
        if (ctx?.orgSlug && ctx?.branchSlug) {
          if (!cancelled) {
            setStatus(`Unlocking ${ctx.branchName || ctx.branchSlug} OPD…`)
          }
          try {
            const res = await api.post('/qms/screen-sso', {
              screen: 'counter',
              orgSlug: ctx.orgSlug,
              branchSlug: ctx.branchSlug,
            })
            url = res.data?.unlockUrl || `${origin}/opd/${ctx.orgSlug}/${ctx.branchSlug}`
          } catch (err) {
            url = `${origin}/opd/${ctx.orgSlug}/${ctx.branchSlug}`
            if (!cancelled) {
              setError(
                err?.response?.data?.message ||
                  err?.message ||
                  'Could not auto-unlock — OPD PIN may still be required',
              )
            }
          }
        } else if (!cancelled) {
          setStatus('Opening Queue Management home…')
        }
      } catch {
        if (!cancelled) setStatus('Opening Queue Management home…')
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
  }, [user?.branchId, user?.branch_id])

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
      <Stack spacing={2} alignItems="center" sx={{ maxWidth: 480, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" fontWeight={800}>
          {status}
        </Typography>
        <Typography color="text.secondary">
          Opened from POS — OPD unlocks automatically (no branch PIN).
        </Typography>
        {error ? (
          <Alert severity="warning" sx={{ width: '100%', textAlign: 'left' }}>
            {error}
          </Alert>
        ) : null}
        <Button
          variant="contained"
          size="large"
          endIcon={<OpenInNew />}
          href={targetUrl}
          component="a"
          sx={{ borderRadius: 2, mt: 1 }}
        >
          Open OPD
        </Button>
      </Stack>
    </Box>
  )
}

export default withAuth(() => (
  <RouteGuard allowedRoles={['ADMIN', 'CASHIER']}>
    <QueueOpdRedirectPage />
  </RouteGuard>
))
