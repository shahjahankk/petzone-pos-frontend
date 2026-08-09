'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Box, Button, Typography } from '@mui/material'
import { VolumeOff, VolumeUp } from '@mui/icons-material'
import { config } from '../../../config/environment'
import { announceQueueCall, speakQueueText, unlockQueueAudio } from '../../../utils/queueAnnounce'

const QMS_BASE = (config.QMS_API_URL || 'http://localhost:4050/api').replace(/\/$/, '')
const DEFAULT_REMOTE_VIDEO =
  'https://videos.pexels.com/video-files/3196257/3196257-uhd_2560_1440_25fps.mp4'

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
  const customVideo = searchParams.get('video')

  const [data, setData] = useState(null)
  const [clock, setClock] = useState('')
  const [error, setError] = useState(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoIndex, setVideoIndex] = useState(0)
  const prevServing = useRef(new Map())
  const announcementState = useRef(new Map())
  const announcementsInitialized = useRef(false)
  const videoRef = useRef(null)
  const [soundEnabled, setSoundEnabled] = useState(false)

  const videoCandidates = [
    customVideo,
    typeof window !== 'undefined' ? window.localStorage.getItem('qms_display_video') : null,
    '/display-video.mp4',
    DEFAULT_REMOTE_VIDEO,
  ].filter(Boolean)

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem('qms_display_sound') === 'on')
  }, [])

  const speakAnnouncement = useCallback((row, isRecall = false) => {
    if (!soundEnabled || !row?.ticket_code) return
    announceQueueCall(row, { isRecall, ttsBaseUrl: QMS_BASE })
  }, [soundEnabled])

  const toggleSound = async () => {
    const enabled = !soundEnabled
    setSoundEnabled(enabled)
    window.localStorage.setItem('qms_display_sound', enabled ? 'on' : 'off')
    if (enabled) {
      await unlockQueueAudio()
      if (videoRef.current) {
        videoRef.current.muted = true
        videoRef.current.play().catch(() => {})
      }
      const ok = await speakQueueText(
        'Queue announcements enabled. Token number 10, please proceed to Grooming.',
        { ttsBaseUrl: QMS_BASE }
      )
      if (!ok) {
        setError('Voice audio failed. Check TV internet, then tap Enable Sound again.')
      } else {
        setError(null)
      }
    }
  }

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

  useEffect(() => {
    const rows = data?.by_counter || []
    if (!announcementsInitialized.current) {
      rows.forEach((row) => {
        announcementState.current.set(String(row.counter_id), {
          code: row.ticket_code || null,
          signature: `${row.ticket_code || ''}|${row.called_at || ''}`,
        })
      })
      announcementsInitialized.current = true
      return
    }

    rows.forEach((row) => {
      const key = String(row.counter_id)
      const previous = announcementState.current.get(key)
      const signature = `${row.ticket_code || ''}|${row.called_at || ''}`
      if (row.ticket_code && previous && previous.signature !== signature) {
        speakAnnouncement(row, previous.code === row.ticket_code)
      }
      announcementState.current.set(key, { code: row.ticket_code || null, signature })
    })
  }, [data, speakAnnouncement])

  useEffect(() => {
    const video = videoRef.current
    if (!video || videoFailed) return
    video.muted = true
    video.play().catch(() => {
      if (videoIndex + 1 < videoCandidates.length) {
        setVideoIndex((i) => i + 1)
      } else {
        setVideoFailed(true)
      }
    })
  }, [videoIndex, videoFailed, videoCandidates.length])

  const byCounter = data?.by_counter || []
  const waiting = data?.waiting_by_service || []
  const totalWaiting = waiting.reduce((s, w) => s + (w.waiting_count || 0), 0)
  const nextRaw = waiting.find((w) => w.next_ticket)?.next_ticket
  const nextNum = displayNum(nextRaw)
  const currentVideoSrc = videoCandidates[videoIndex] || null

  return (
    <Box sx={{
      minHeight: '100vh',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#07111f',
      color: '#fff',
      overflow: 'hidden',
      fontFamily: '"Manrope", "Segoe UI", system-ui, sans-serif',
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 3, py: 1.5,
        background: 'linear-gradient(180deg, rgba(7,17,31,0.96), rgba(7,17,31,0.82))',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography sx={{ fontFamily: '"Sora", sans-serif', fontWeight: 800, fontSize: 'clamp(18px, 2vw, 28px)' }}>
              PetZone Hospital
            </Typography>
            {data?.branch?.name && (
              <Typography variant="body2" sx={{ opacity: 0.65 }}>{data.branch.name}</Typography>
            )}
          </Box>
          <Button
            variant={soundEnabled ? 'contained' : 'outlined'}
            color={soundEnabled ? 'success' : 'inherit'}
            startIcon={soundEnabled ? <VolumeUp /> : <VolumeOff />}
            onClick={toggleSound}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.55)', borderRadius: 999 }}
          >
            {soundEnabled ? 'Sound On' : 'Enable Sound'}
          </Button>
        </Box>
        <Typography sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontSize: 'clamp(20px, 2.2vw, 32px)', opacity: 0.92 }}>
          {clock}
        </Typography>
      </Box>

      {error && <Typography color="error.light" sx={{ px: 3, pt: 1 }}>{error}</Typography>}

      <Box sx={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 30%' },
        gridTemplateRows: { xs: '55% 45%', md: '1fr' },
      }}>
        <Box sx={{ position: 'relative', overflow: 'hidden', bgcolor: '#0b1a2e', minHeight: 0 }}>
          {!videoFailed && currentVideoSrc ? (
            <Box
              component="video"
              ref={videoRef}
              key={currentVideoSrc}
              src={currentVideoSrc}
              autoPlay
              muted
              loop
              playsInline
              onError={() => {
                if (videoIndex + 1 < videoCandidates.length) setVideoIndex((i) => i + 1)
                else setVideoFailed(true)
              }}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Box sx={{
              position: 'absolute', inset: 0,
              background:
                'radial-gradient(ellipse at 20% 20%, rgba(56,189,248,0.22), transparent 45%), radial-gradient(ellipse at 80% 30%, rgba(244,114,182,0.18), transparent 40%), linear-gradient(145deg, #0a1628 0%, #12305f 50%, #1e3a8a 100%)',
              animation: 'qmsAmbient 18s ease-in-out infinite alternate',
              '@keyframes qmsAmbient': {
                from: { filter: 'hue-rotate(0deg)', transform: 'scale(1)' },
                to: { filter: 'hue-rotate(18deg)', transform: 'scale(1.04)' },
              },
            }} />
          )}
          <Box sx={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(90deg, rgba(7,17,31,0.15), transparent 28%, transparent 72%, rgba(7,17,31,0.55)), linear-gradient(180deg, rgba(7,17,31,0.25), transparent 30%, transparent 70%, rgba(7,17,31,0.35))',
          }} />
          <Box sx={{ position: 'absolute', left: 28, bottom: 24, zIndex: 2, maxWidth: '55%', textShadow: '0 8px 30px rgba(0,0,0,0.55)' }}>
            <Typography sx={{ fontFamily: '"Sora", sans-serif', fontWeight: 800, fontSize: 'clamp(20px, 2.4vw, 36px)', mb: 0.5 }}>
              Caring for every pet
            </Typography>
            <Typography sx={{ fontWeight: 600, opacity: 0.8, fontSize: 'clamp(13px, 1.1vw, 17px)' }}>
              Relax while we call your token
            </Typography>
          </Box>
        </Box>

        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          background: 'linear-gradient(180deg, #0d1b2e 0%, #102445 55%, #0c274f 100%)',
          borderLeft: { md: '1px solid rgba(255,255,255,0.1)' },
          borderTop: { xs: '1px solid rgba(255,255,255,0.1)', md: 0 },
          p: 2,
        }}>
          <Typography sx={{
            fontFamily: '"Sora", sans-serif', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.5, mb: 1.5,
          }}>
            Now Serving
          </Typography>

          <Box sx={{
            flex: 1, minHeight: 0, display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            gap: 1.25, overflow: 'hidden',
          }}>
            {byCounter.length === 0 ? (
              <Box sx={{
                flex: 1, borderRadius: '18px', border: '1px solid rgba(255,255,255,0.1)',
                bgcolor: 'rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography sx={{ opacity: 0.45, fontSize: 48, fontWeight: 900 }}>—</Typography>
              </Box>
            ) : byCounter.map((row) => {
              const num = displayNum(row.ticket_code)
              const key = String(row.counter_id)
              const changed = prevServing.current.get(key) !== row.ticket_code
              prevServing.current.set(key, row.ticket_code)
              const active = Boolean(num)
              const isGrooming = /groom/i.test(String(row.counter_label || row.counter_name || row.service_name || ''))

              return (
                <Box key={row.counter_id} sx={{
                  flex: 1, minHeight: 0, minWidth: 0, borderRadius: '18px',
                  border: active ? '1px solid #ffb6c1' : '1px solid rgba(255,255,255,0.1)',
                  bgcolor: active ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.06)',
                  boxShadow: active ? '0 0 36px rgba(255,182,193,0.18)' : 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  transform: changed && active ? 'scale(1.02)' : 'none',
                  transition: 'transform 0.3s ease',
                  position: 'relative', overflow: 'hidden',
                  px: 1, py: 1,
                  '&::before': {
                    content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: active ? 'linear-gradient(90deg, #ffb6c1, #f472b6)' : 'rgba(255,255,255,0.14)',
                  },
                }}>
                  <Typography sx={{
                    fontSize: 'clamp(12px, 1vw, 16px)', fontWeight: 800, letterSpacing: '0.1em',
                    textTransform: 'uppercase', opacity: active ? 1 : 0.7, color: active ? '#ffb6c1' : 'inherit', mb: 0.5,
                  }}>
                    {row.counter_label || row.counter_name}
                  </Typography>
                  <Typography sx={{
                    fontFamily: '"Sora", sans-serif',
                    fontSize: active ? 'clamp(40px, 5vw, 72px)' : 'clamp(32px, 4vw, 54px)',
                    fontWeight: 800, lineHeight: 1,
                    color: active ? '#ffb6c1' : 'rgba(255,255,255,0.18)',
                    textShadow: active ? '0 4px 28px rgba(255,182,193,0.4)' : 'none',
                  }}>
                    {num || '—'}
                  </Typography>
                  <Typography sx={{ mt: 0.75, fontSize: 'clamp(11px, 0.9vw, 13px)', fontWeight: 600, opacity: active ? 0.9 : 0.5, textAlign: 'center' }}>
                    {!num
                      ? 'Waiting for patient'
                      : row.status === 'serving'
                        ? (isGrooming ? 'In grooming' : 'In consultation')
                        : (isGrooming ? 'Please proceed to grooming' : 'Please proceed to room')}
                  </Typography>
                </Box>
              )
            })}
          </Box>

          <Box sx={{
            mt: 1.5, px: 1.5, py: 1.25, borderRadius: '14px',
            bgcolor: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', flexDirection: 'column', gap: 1,
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.45 }}>
                Waiting
              </Typography>
              <Typography sx={{ fontSize: 'clamp(13px, 1.1vw, 15px)', fontWeight: 600 }}>
                {totalWaiting > 0
                  ? <><strong>{totalWaiting}</strong> <span style={{ opacity: 0.5 }}>in queue</span></>
                  : <em style={{ opacity: 0.42 }}>Queue is clear</em>}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.45 }}>
                Up Next
              </Typography>
              <Typography sx={{
                fontFamily: '"Sora", sans-serif', fontSize: 'clamp(26px, 3.2vw, 40px)',
                fontWeight: 800, color: '#ffb6c1', lineHeight: 1,
              }}>
                {nextNum || '—'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
