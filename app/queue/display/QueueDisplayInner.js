'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Box, Typography } from '@mui/material'
import { config } from '../../../config/environment'

const QMS_BASE = (config.QMS_API_URL || 'http://localhost:4050/api').replace(/\/$/, '')

function displayNum(code) {
  if (!code) return null
  const stripped = String(code).replace(/^[A-Za-z]+/, '')
  const num = parseInt(stripped, 10)
  return Number.isNaN(num) ? stripped : String(num)
}

async function fetchStatus(org, branch) {
  const res = await fetch(`${QMS_BASE}/queue/public/${org}/${branch}/status`)
  const json = await res.json()
  if (!json.success) throw new Error(json.message)
  return json.data
}

export default function QueueDisplayInner() {
  const searchParams = useSearchParams()
  const org = searchParams.get('org') || process.env.NEXT_PUBLIC_QMS_ORG_SLUG || 'petzone'
  const branch = searchParams.get('branch') || process.env.NEXT_PUBLIC_QMS_BRANCH_SLUG || 'main'

  const [data, setData] = useState(null)
  const [clock, setClock] = useState('')
  const [error, setError] = useState(null)
  const prevServing = useRef(new Map())

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const refresh = async () => {
      try {
        const status = await fetchStatus(org, branch)
        setData(status)
        setError(null)
      } catch (err) {
        setError(err.message)
      }
    }
    refresh()
    const id = setInterval(refresh, 2500)
    return () => clearInterval(id)
  }, [org, branch])

  const byCounter = data?.by_counter || []
  const waiting = data?.waiting_by_service || []
  const totalWaiting = waiting.reduce((s, w) => s + (w.waiting_count || 0), 0)
  const nextRaw = waiting.find((w) => w.next_ticket)?.next_ticket
  const nextNum = displayNum(nextRaw)

  return (
    <Box sx={{
      minHeight: '100vh',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(160deg, #0a1628 0%, #1e3a8a 55%, #1e40af 100%)',
      color: '#fff',
      overflow: 'hidden',
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 5, py: 2.5, bgcolor: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <Typography variant="h5" fontWeight={800}>{data?.branch?.name || 'PetZone Clinic'}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>{clock}</Typography>
      </Box>

      {error && <Typography color="error.light" sx={{ px: 5, pt: 2 }}>{error}</Typography>}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 5, pt: 3.5, pb: 2, minHeight: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.45, mb: 2.5 }}>
          Now Serving
        </Typography>

        <Box sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(byCounter.length, 1)}, 1fr)`,
          gap: 3,
          minHeight: 0,
        }}>
          {byCounter.length === 0 ? (
            <Box sx={{
              borderRadius: '28px', border: '2px solid rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Typography sx={{ opacity: 0.5, fontSize: 80, fontWeight: 900 }}>—</Typography>
            </Box>
          ) : byCounter.map((row) => {
            const num = displayNum(row.ticket_code)
            const key = String(row.counter_id)
            const changed = prevServing.current.get(key) !== row.ticket_code
            prevServing.current.set(key, row.ticket_code)
            const active = Boolean(num)

            return (
              <Box key={row.counter_id} sx={{
                borderRadius: '28px',
                border: active ? '2px solid #ffb6c1' : '2px solid rgba(255,255,255,0.12)',
                bgcolor: active ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.07)',
                boxShadow: active ? '0 0 60px rgba(255,182,193,0.2)' : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                transform: changed && active ? 'scale(1.02)' : 'none',
                transition: 'transform 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 5,
                  background: active ? 'linear-gradient(90deg, #ffb6c1, #f472b6)' : 'rgba(255,255,255,0.15)',
                },
              }}>
                <Typography sx={{
                  fontSize: 'clamp(20px, 2.2vw, 32px)', fontWeight: 800, letterSpacing: '0.12em',
                  textTransform: 'uppercase', opacity: active ? 1 : 0.7, color: active ? '#ffb6c1' : 'inherit', mb: 1,
                }}>
                  {row.counter_label || row.counter_name}
                </Typography>
                <Typography sx={{
                  fontSize: active ? 'clamp(80px, 14vw, 160px)' : 'clamp(60px, 10vw, 100px)',
                  fontWeight: 900, lineHeight: 1, color: active ? '#ffb6c1' : 'rgba(255,255,255,0.15)',
                  textShadow: active ? '0 4px 40px rgba(255,182,193,0.45)' : 'none',
                }}>
                  {num || '—'}
                </Typography>
                <Typography sx={{ mt: 1.5, fontSize: 'clamp(14px, 1.4vw, 20px)', fontWeight: 600, opacity: active ? 0.85 : 0.5 }}>
                  {num ? (row.status === 'serving' ? 'In consultation' : 'Please proceed to room') : 'Waiting for patient'}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>

      <Box sx={{
        mx: 5, mb: 3.5, px: 4, py: 2.5,
        bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.45 }}>
            Waiting
          </Typography>
          <Typography sx={{ fontSize: 'clamp(16px, 1.8vw, 22px)', fontWeight: 600 }}>
            {totalWaiting > 0 ? <><strong>{totalWaiting}</strong> patient{totalWaiting !== 1 ? 's' : ''} in queue</> : <em style={{ opacity: 0.4 }}>Queue is clear</em>}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Up Next
          </Typography>
          <Typography sx={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 900, color: '#ffb6c1', lineHeight: 1 }}>
            {nextNum || '—'}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
