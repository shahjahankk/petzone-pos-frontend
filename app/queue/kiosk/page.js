'use client'

/**
 * POS Queue Token kiosk UI was moved to the standalone Queue Management System.
 * Legacy implementation kept at: ./page.legacy.js (not routed).
 *
 * Menu → Queue Token now opens QMS:
 *   https://queue-management.petzone.pk/
 * Branch-specific kiosks (examples):
 *   https://queue-management.petzone.pk/kiosk/petzone/main
 *   https://queue-management.petzone.pk/kiosk/petzone/north
 */

import { useEffect, useState } from 'react'
import { Box, CircularProgress, Typography, Button, Stack } from '@mui/material'
import { OpenInNew } from '@mui/icons-material'
import { useSelector } from 'react-redux'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import { resolveQueueBranch } from '../../../utils/queueApi'
import { config } from '../../../config/environment'

const QMS_HOME = 'https://queue-management.petzone.pk/'

function qmsOrigin() {
  try {
    const api = (config.QMS_API_URL || QMS_HOME).replace(/\/api\/?$/, '')
    return api || QMS_HOME.replace(/\/$/, '')
  } catch {
    return QMS_HOME.replace(/\/$/, '')
  }
}

function QueueKioskRedirectPage() {
  const { user } = useSelector((s) => s.auth)
  const [targetUrl, setTargetUrl] = useState(QMS_HOME)
  const [status, setStatus] = useState('Opening Queue Management…')

  useEffect(() => {
    let cancelled = false

    async function go() {
      const origin = qmsOrigin()
      let url = `${origin}/`

      try {
        const posBranchId = user?.branchId || user?.branch_id || null
        const ctx = await resolveQueueBranch(posBranchId)
        if (ctx?.orgSlug && ctx?.branchSlug) {
          url = `${origin}/kiosk/${ctx.orgSlug}/${ctx.branchSlug}`
          if (!cancelled) {
            setStatus(`Opening ${ctx.branchName || ctx.branchSlug} ticket kiosk…`)
          }
        } else {
          if (!cancelled) setStatus('Opening Queue Management home…')
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
    return () => { cancelled = true }
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
          Ticketing now runs on the Queue Management site (same simple Consultation / Grooming buttons).
        </Typography>
        <Button
          variant="contained"
          size="large"
          endIcon={<OpenInNew />}
          href={targetUrl}
          component="a"
          sx={{ borderRadius: 2, mt: 1 }}
        >
          Open Queue Management
        </Button>
        <Button variant="text" href={QMS_HOME} component="a">
          {QMS_HOME}
        </Button>
      </Stack>
    </Box>
  )
}

export default withAuth(() => (
  <RouteGuard allowedRoles={['ADMIN', 'CASHIER']}>
    <QueueKioskRedirectPage />
  </RouteGuard>
))
