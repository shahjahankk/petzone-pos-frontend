'use client'

import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { getPkTime, toPkDateKey } from '../../utils/pkTime'

export default function ShiftMidnightAlerts({ activeShift, onOpenFinalCash }) {
  const [warningOpen, setWarningOpen] = useState(false)
  const [finalOpen, setFinalOpen] = useState(false)
  const [warningDate, setWarningDate] = useState('')
  const [finalDate, setFinalDate] = useState('')

  useEffect(() => {
    const sessionId = activeShift?.id
    if (!sessionId) {
      setWarningOpen(false)
      setFinalOpen(false)
      return undefined
    }

    const warningKey = `shiftMidnightWarning:${sessionId}`
    const finalKey = `shiftMidnightFinal:${sessionId}`
    const snoozeKey = `shiftMidnightSnooze:${sessionId}`

    const check = () => {
      const pk = getPkTime()
      const shiftStartDate = toPkDateKey(activeShift?.actual_start_time)

      if (pk.hour === 23 && pk.minute >= 45 && (!shiftStartDate || shiftStartDate <= pk.dateKey) && !localStorage.getItem(warningKey)) {
        setWarningDate(pk.dateKey)
        setWarningOpen(true)
      }

      if (pk.hour === 0 && (!shiftStartDate || shiftStartDate < pk.dateKey) && !localStorage.getItem(finalKey)) {
        const snoozeUntil = Number(localStorage.getItem(snoozeKey) || 0)
        if (Date.now() >= snoozeUntil) {
          setFinalDate(pk.dateKey)
          setFinalOpen(true)
        }
      }
    }

    check()
    const timer = setInterval(check, 30000)
    return () => clearInterval(timer)
  }, [activeShift?.id, activeShift?.actual_start_time])

  const acknowledgeWarning = (closeNow) => {
    if (activeShift?.id) localStorage.setItem(`shiftMidnightWarning:${activeShift.id}`, '1')
    setWarningOpen(false)
    if (closeNow) onOpenFinalCash?.()
  }

  const snoozeFinal = () => {
    if (activeShift?.id) localStorage.setItem(`shiftMidnightSnooze:${activeShift.id}`, String(Date.now() + 5 * 60 * 1000))
    setFinalOpen(false)
  }

  const openFinalCash = () => {
    if (activeShift?.id) localStorage.setItem(`shiftMidnightFinal:${activeShift.id}`, '1')
    setFinalOpen(false)
    onOpenFinalCash?.()
  }

  return (
    <>
      <Dialog open={warningOpen} onClose={() => acknowledgeWarning(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: 'warning.main', color: 'warning.contrastText' }}>
          15-minute shift warning
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            It is 11:45 PM PK time. Your shift is still active.
          </Alert>
          <Typography variant="body2">
            Please count the drawer and be ready to enter final cash when the 12:59 AM alert appears.
          </Typography>
          {warningDate && (
            <Typography variant="caption" color="text.secondary">
              PK date: {warningDate}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => acknowledgeWarning(false)}>Got it</Button>
          <Button variant="contained" color="warning" onClick={() => acknowledgeWarning(true)}>
            Close shift now
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={finalOpen} onClose={snoozeFinal} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'error.contrastText' }}>
          12:59 AM — Final cash required
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            Your shift is still active at 12:59 AM PK time.
          </Alert>
          <Typography variant="body2">
            Enter the counted final cash now. The shift will be closed with the sales counted up to this moment.
          </Typography>
          {finalDate && (
            <Typography variant="caption" color="text.secondary">
              PK date: {finalDate}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={snoozeFinal}>Remind in 5 min</Button>
          <Button variant="contained" color="error" onClick={openFinalCash}>
            Enter Final Cash
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
