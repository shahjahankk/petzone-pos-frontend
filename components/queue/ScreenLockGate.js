'use client'

import React, { useEffect, useState } from 'react'
import {
  Box, Button, CircularProgress, Paper, TextField, Typography, Alert,
} from '@mui/material'
import { Lock } from '@mui/icons-material'
import { getScreenLockStatus, unlockScreen } from '../../utils/queueApi'

function storageKey(screen, orgSlug, branchSlug) {
  return `qms-unlock-${screen}-${orgSlug}-${branchSlug}`
}

/**
 * Password gate for OPD counter / Take-a-ticket kiosk (PIN from Admin → Branches).
 */
export default function ScreenLockGate({ screen, orgSlug, branchSlug, children }) {
  const [checking, setChecking] = useState(true)
  const [locked, setLocked] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!orgSlug || !branchSlug) {
        setChecking(false)
        return
      }
      try {
        const status = await getScreenLockStatus(orgSlug, branchSlug)
        const required = screen === 'kiosk' ? !!status?.kiosk_required : !!status?.counter_required
        const unlocked = typeof window !== 'undefined'
          && window.sessionStorage.getItem(storageKey(screen, orgSlug, branchSlug)) === '1'
        if (!cancelled) {
          setLocked(required && !unlocked)
        }
      } catch {
        if (!cancelled) setLocked(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => { cancelled = true }
  }, [screen, orgSlug, branchSlug])

  const tryUnlock = async () => {
    const value = pin.trim()
    if (!value) {
      setError('Enter password')
      return
    }
    setBusy(true)
    setError('')
    try {
      await unlockScreen(orgSlug, branchSlug, screen, value)
      window.sessionStorage.setItem(storageKey(screen, orgSlug, branchSlug), '1')
      setLocked(false)
      setPin('')
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Incorrect password')
    } finally {
      setBusy(false)
    }
  }

  if (checking) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!locked) return children

  const title = screen === 'kiosk' ? 'Take a Ticket Locked' : 'OPD / Counter Locked'

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: '#0f172a',
      p: 2,
    }}>
      <Paper sx={{ width: '100%', maxWidth: 400, p: 3.5, borderRadius: 3 }}>
        <Typography variant="overline" color="primary" fontWeight={700}>PetZone Hospital</Typography>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter the password set in Admin → Branches.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        <TextField
          fullWidth
          type="password"
          label="Password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock() }}
          autoFocus
          sx={{ mb: 2 }}
        />
        <Button
          fullWidth
          variant="contained"
          size="large"
          startIcon={<Lock />}
          onClick={tryUnlock}
          disabled={busy}
        >
          {busy ? 'Checking…' : 'Unlock'}
        </Button>
      </Paper>
    </Box>
  )
}
