'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Box, Button, Typography } from '@mui/material'
import { VolumeOff, VolumeUp } from '@mui/icons-material'
import { config } from '../../../config/environment'
import { announceQueueCall, speakQueueText, unlockQueueAudio, setAmbientAudioControl } from '../../../utils/queueAnnounce'

const QMS_BASE = (config.QMS_API_URL || 'http://localhost:4050/api').replace(/\/$/, '')

// Muted YouTube animal / 4K backgrounds (sound only for token call/recall)
const DEFAULT_YOUTUBE_IDS = [
  'K1REumSu-Fk', // 12h nature fun for cats & dogs (4K HDR)
  'WDyzAi_oetU', // spring deer, squirrels & birds (4K)
  'odF2ec97dPI', // deer & birds calm nature
]
const FALLBACK_MP4 = [
  'https://videos.pexels.com/video-files/3196257/3196257-uhd_2560_1440_25fps.mp4',
  '/display-video.mp4',
]

function extractYouTubeId(value) {
  if (!value) return null
  const raw = String(value).trim()
  if (/^[\w-]{11}$/.test(raw)) return raw
  try {
    const u = new URL(raw)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null
    if (u.searchParams.get('v')) return u.searchParams.get('v')
    const parts = u.pathname.split('/').filter(Boolean)
    const embedIdx = parts.indexOf('embed')
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1]
    const shortsIdx = parts.indexOf('shorts')
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1]
  } catch (_) { /* not a URL */ }
  return null
}

function youtubeEmbedUrl(id, withSound = false) {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: withSound ? '0' : '1',
    controls: '0',
    loop: '1',
    playlist: id,
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
    iv_load_policy: '3',
    disablekb: '1',
    fs: '0',
    enablejsapi: '1',
  })
  if (typeof window !== 'undefined' && window.location?.origin) {
    params.set('origin', window.location.origin)
  }
  return `https://www.youtube.com/embed/${id}?${params.toString()}`
}

const AMBIENT_YT_VOLUME = 60
const AMBIENT_MP4_VOLUME = 0.55

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
  const customVideo = searchParams.get('youtube') || searchParams.get('video')

  const [data, setData] = useState(null)
  const [clock, setClock] = useState('')
  const [dateLine, setDateLine] = useState('')
  const [error, setError] = useState(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoIndex, setVideoIndex] = useState(0)
  const prevServing = useRef(new Map())
  const announcementState = useRef(new Map())
  const announcementsInitialized = useRef(false)
  const videoRef = useRef(null)
  const ytIframeRef = useRef(null)
  const ambientWantedRef = useRef(false)
  const ambientDuckedRef = useRef(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [storedVideo, setStoredVideo] = useState(null)
  const [ytWithSound, setYtWithSound] = useState(false)

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem('qms_display_sound') === 'on')
    setStoredVideo(window.localStorage.getItem('qms_display_video'))
  }, [])

  const customOrStored = customVideo || storedVideo
  const youtubeId = useMemo(() => {
    const fromCustom = extractYouTubeId(customOrStored)
    if (fromCustom) return fromCustom
    if (customOrStored && !fromCustom) return null
    return DEFAULT_YOUTUBE_IDS[0]
  }, [customOrStored])

  const mp4Candidates = useMemo(() => {
    const list = []
    if (customOrStored && !extractYouTubeId(customOrStored)) list.push(customOrStored)
    list.push(...FALLBACK_MP4)
    return list.filter(Boolean)
  }, [customOrStored])

  const ytCommand = useCallback((func, args = []) => {
    const iframe = ytIframeRef.current
    if (!iframe?.contentWindow) return
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func,
      args,
    }), '*')
  }, [])

  const setAmbientPlaying = useCallback((on) => {
    ambientWantedRef.current = Boolean(on)
    if (!on) ambientDuckedRef.current = false
    if (youtubeId) {
      // Remount unmuted inside the click gesture so TV browsers allow audio
      setYtWithSound(Boolean(on))
      if (on) {
        setTimeout(() => {
          ytCommand('unMute')
          ytCommand('setVolume', [AMBIENT_YT_VOLUME])
          ytCommand('playVideo')
        }, 700)
        setTimeout(() => {
          ytCommand('unMute')
          ytCommand('setVolume', [AMBIENT_YT_VOLUME])
          ytCommand('playVideo')
        }, 1800)
      } else {
        ytCommand('mute')
        ytCommand('setVolume', [0])
      }
      return
    }
    const video = videoRef.current
    if (!video) return
    if (on) {
      video.muted = false
      video.volume = AMBIENT_MP4_VOLUME
      video.play().catch(() => {})
    } else {
      video.muted = true
      video.volume = 0
    }
  }, [youtubeId, ytCommand])

  const duckAmbientAudio = useCallback(() => {
    ambientDuckedRef.current = true
    if (youtubeId) {
      ytCommand('mute')
      ytCommand('setVolume', [0])
      return
    }
    const video = videoRef.current
    if (video) {
      video.muted = true
      video.volume = 0
    }
  }, [youtubeId, ytCommand])

  const restoreAmbientAudio = useCallback(() => {
    ambientDuckedRef.current = false
    if (!ambientWantedRef.current || !soundEnabled) return
    if (youtubeId) {
      ytCommand('unMute')
      ytCommand('setVolume', [AMBIENT_YT_VOLUME])
      ytCommand('playVideo')
      return
    }
    const video = videoRef.current
    if (video) {
      video.muted = false
      video.volume = AMBIENT_MP4_VOLUME
      video.play().catch(() => {})
    }
  }, [youtubeId, ytCommand, soundEnabled])

  useEffect(() => {
    setAmbientAudioControl({
      duck: duckAmbientAudio,
      restore: restoreAmbientAudio,
    })
    return () => setAmbientAudioControl(null)
  }, [duckAmbientAudio, restoreAmbientAudio])

  const speakAnnouncement = useCallback((row, isRecall = false) => {
    if (!soundEnabled || !row?.ticket_code) return
    announceQueueCall(row, { isRecall, ttsBaseUrl: QMS_BASE })
  }, [soundEnabled])

  const toggleSound = async () => {
    const enabled = !soundEnabled
    setSoundEnabled(enabled)
    window.localStorage.setItem('qms_display_sound', enabled ? 'on' : 'off')
    if (enabled) {
      // Inside click gesture — open video sound first
      ambientWantedRef.current = true
      ambientDuckedRef.current = false
      setAmbientPlaying(true)
      await unlockQueueAudio()
      await new Promise((r) => setTimeout(r, 900))
      const ok = await speakQueueText(
        'Queue announcements enabled. Token number 10, please proceed to Grooming.',
        { ttsBaseUrl: QMS_BASE }
      )
      setTimeout(() => { if (ambientWantedRef.current) restoreAmbientAudio() }, 400)
      setTimeout(() => { if (ambientWantedRef.current) restoreAmbientAudio() }, 1400)
      if (!ok) {
        setError('Token voice failed. Video sound may still work — tap Enable Sound again if needed.')
      } else {
        setError(null)
      }
    } else {
      setAmbientPlaying(false)
    }
  }

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setDateLine(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }))
    }
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
    if (youtubeId) return
    const video = videoRef.current
    if (!video || videoFailed) return
    video.muted = !soundEnabled
    video.volume = soundEnabled ? AMBIENT_MP4_VOLUME : 0
    video.play().catch(() => {
      if (videoIndex + 1 < mp4Candidates.length) {
        setVideoIndex((i) => i + 1)
      } else {
        setVideoFailed(true)
      }
    })
  }, [youtubeId, videoIndex, videoFailed, mp4Candidates.length, soundEnabled])

  const byCounter = data?.by_counter || []
  const waiting = data?.waiting_by_service || []
  const totalWaiting = waiting.reduce((s, w) => s + (w.waiting_count || 0), 0)
  const nextRaw = waiting.find((w) => w.next_ticket)?.next_ticket
  const nextNum = displayNum(nextRaw)
  const currentMp4 = mp4Candidates[videoIndex] || null

  return (
    <Box sx={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      bgcolor: '#020617',
      color: '#fff',
      fontFamily: '"Manrope", system-ui, sans-serif',
    }}>
      <Box sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        background:
          'radial-gradient(ellipse at 30% 40%, rgba(13,148,136,0.35), transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(14,116,144,0.3), transparent 50%), linear-gradient(145deg, #0c4a6e, #134e4a 50%, #0f172a)',
      }}>
        {youtubeId ? (
          <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <Box
              component="iframe"
              ref={ytIframeRef}
              key={`${youtubeId}-${ytWithSound ? 'sound' : 'mute'}`}
              title="PetZone ambient video"
              src={youtubeEmbedUrl(youtubeId, ytWithSound)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '100vw',
                height: '56.25vw',
                minHeight: '100vh',
                minWidth: '177.78vh',
                transform: 'translate(-50%, -50%)',
                border: 0,
                pointerEvents: 'none',
              }}
            />
          </Box>
        ) : !videoFailed && currentMp4 ? (
          <Box
            component="video"
            ref={videoRef}
            key={currentMp4}
            src={currentMp4}
            autoPlay
            muted={!soundEnabled}
            loop
            playsInline
            onError={() => {
              if (videoIndex + 1 < mp4Candidates.length) setVideoIndex((i) => i + 1)
              else setVideoFailed(true)
            }}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Box sx={{
            position: 'absolute', inset: 0,
            '@keyframes qmsFloat': {
              '0%, 100%': { transform: 'translateY(0) rotate(-8deg)' },
              '50%': { transform: 'translateY(-28px) rotate(8deg)' },
            },
          }}>
            {['🐾', '🐕', '🐈', '🐾'].map((paw, i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  left: `${8 + i * 20}%`,
                  top: `${18 + (i % 2) * 34}%`,
                  fontSize: 'clamp(2rem, 5vw, 4.5rem)',
                  opacity: 0.12,
                  animation: 'qmsFloat 14s ease-in-out infinite',
                  animationDelay: `${-i * 3}s`,
                }}
              >
                {paw}
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'linear-gradient(90deg, rgba(2,6,23,0.18) 0%, rgba(2,6,23,0.08) 55%, rgba(2,6,23,0.45) 100%), linear-gradient(180deg, rgba(2,6,23,0.55) 0%, transparent 22%, transparent 78%, rgba(2,6,23,0.4) 100%)',
        }} />
      </Box>

      <Box sx={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        px: 3,
        py: 1.75,
        background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.55), rgba(2, 6, 23, 0.18))',
        backdropFilter: 'blur(14px) saturate(1.15)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.15)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
      }}>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.4 }}>
          <Typography
            component="div"
            sx={{
              fontFamily: 'var(--font-outfit), "Outfit", system-ui, sans-serif',
              fontSize: 'clamp(1.85rem, 3.8vw, 3.1rem)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              color: '#fff',
              whiteSpace: 'nowrap',
              textShadow: '0 2px 16px rgba(2, 6, 23, 0.55)',
              '& em': {
                fontStyle: 'normal',
                fontWeight: 800,
                color: '#fff',
              },
            }}
          >
            <em>PetZone</em> Animal Hospital
          </Typography>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.25,
            '&::before, &::after': {
              content: '""',
              width: 22,
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(153,246,228,0.7), transparent)',
            },
          }}>
            <Typography sx={{
              fontFamily: 'var(--font-outfit), "Outfit", system-ui, sans-serif',
              fontSize: 'clamp(0.62rem, 1vw, 0.78rem)',
              fontWeight: 700,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'rgba(226,232,240,0.88)',
              whiteSpace: 'nowrap',
            }}>
              Compassion · Care · Excellence
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
          <Button
            variant={soundEnabled ? 'contained' : 'outlined'}
            startIcon={soundEnabled ? <VolumeUp /> : <VolumeOff />}
            onClick={toggleSound}
            sx={{
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.35)',
              borderRadius: 999,
              bgcolor: soundEnabled ? 'rgba(13,148,136,0.55)' : 'rgba(15,23,42,0.35)',
              backdropFilter: 'blur(8px)',
              fontWeight: 700,
              fontSize: '0.78rem',
              px: 1.5,
              display: { xs: 'none', md: 'inline-flex' },
              '&:hover': {
                bgcolor: soundEnabled ? 'rgba(13,148,136,0.7)' : 'rgba(15,23,42,0.5)',
                borderColor: 'rgba(255,255,255,0.5)',
              },
            }}
          >
            {soundEnabled ? 'Sound On' : 'Enable Sound'}
          </Button>
          <Box sx={{
            textAlign: 'right',
            px: 1.5, py: 0.75,
            borderRadius: '12px',
            bgcolor: 'rgba(15,23,42,0.28)',
            border: '1px solid rgba(255,255,255,0.22)',
            backdropFilter: 'blur(8px)',
          }}>
            <Typography sx={{
              fontFamily: 'var(--font-outfit), "Outfit", system-ui, sans-serif',
              fontSize: 'clamp(1.1rem, 2vw, 1.55rem)',
              fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
            }}>
              {clock}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', mt: 0.25 }}>
              {dateLine}
            </Typography>
          </Box>
        </Box>
      </Box>

      {error && (
        <Typography color="error.light" sx={{ position: 'absolute', top: 88, left: 20, zIndex: 40, px: 1 }}>
          {error}
        </Typography>
      )}

      <Box sx={{
        position: 'absolute',
        top: { xs: 92, md: 88 },
        right: 14,
        bottom: 14,
        width: { xs: 'min(42vw, 280px)', md: 'clamp(240px, 15vw, 320px)' },
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        p: 1.5,
        borderRadius: '22px',
        background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.78), rgba(2, 6, 23, 0.88))',
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 20px 50px rgba(2, 6, 23, 0.55), inset 0 1px 0 rgba(255,255,255,0.14)',
      }}>
        <Box sx={{ textAlign: 'center', pb: 1, borderBottom: '1px solid rgba(255,255,255,0.22)' }}>
          <Typography sx={{
            fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#99f6e4',
          }}>
            Live queue
          </Typography>
          <Typography sx={{
            fontFamily: 'var(--font-outfit), "Outfit", system-ui, sans-serif', fontSize: '1.05rem', fontWeight: 800, mt: 0.25,
            textShadow: '0 2px 10px rgba(2,6,23,0.35)',
          }}>
            Now Serving
          </Typography>
        </Box>

        <Box sx={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden',
        }}>
          {byCounter.length === 0 ? (
            <Box sx={{
              flex: 1, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.22)',
              bgcolor: 'rgba(255,255,255,0.14)', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', opacity: 0.72,
            }}>
              <Typography sx={{ fontFamily: 'var(--font-outfit), "Outfit", system-ui, sans-serif', fontSize: 40, fontWeight: 800 }}>—</Typography>
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
                flex: 1, minHeight: 0, borderRadius: '16px',
                border: active ? '1px solid rgba(153,246,228,0.55)' : '1px solid rgba(255,255,255,0.22)',
                background: active
                  ? 'linear-gradient(160deg, rgba(13,148,136,0.55), rgba(15,23,42,0.35))'
                  : 'rgba(255,255,255,0.14)',
                boxShadow: active ? '0 10px 28px rgba(13,148,136,0.28)' : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                opacity: active ? 1 : 0.72,
                animation: changed && active ? 'qmsPulse 1.1s ease-in-out 3' : 'none',
                '@keyframes qmsPulse': {
                  '0%, 100%': { boxShadow: '0 0 0 0 rgba(45,212,191,0)' },
                  '50%': { boxShadow: '0 0 0 10px rgba(45,212,191,0.25)' },
                },
                px: 0.75, py: 0.75, textAlign: 'center',
              }}>
                <Typography sx={{
                  fontSize: 'clamp(0.95rem, 1.5vw, 1.25rem)', fontWeight: 800,
                  letterSpacing: '0.04em', textTransform: 'uppercase', color: '#ccfbf1', lineHeight: 1.15,
                }}>
                  {row.counter_label || row.counter_name}
                </Typography>
                <Typography sx={{
                  fontFamily: 'var(--font-outfit), "Outfit", system-ui, sans-serif',
                  fontSize: 'clamp(3.4rem, 7.5vw, 5.8rem)',
                  fontWeight: 800, lineHeight: 0.95, my: 0.45, letterSpacing: '-0.03em',
                  textShadow: '0 4px 18px rgba(2,6,23,0.45)',
                }}>
                  {num || '—'}
                </Typography>
                <Typography sx={{
                  fontSize: 'clamp(0.78rem, 1.1vw, 0.95rem)', fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: row.status === 'serving' && active ? '#fde68a' : 'rgba(255,255,255,0.88)',
                }}>
                  {!num
                    ? 'Waiting'
                    : row.status === 'serving'
                      ? (isGrooming ? 'Grooming' : 'Consult')
                      : (isGrooming ? 'To grooming' : 'To room')}
                </Typography>
              </Box>
            )
          })}
        </Box>

        <Box sx={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75,
          pt: 1, borderTop: '1px solid rgba(255,255,255,0.2)',
        }}>
          <Box sx={{
            textAlign: 'center', px: 0.5, py: 0.75, borderRadius: '12px',
            bgcolor: 'rgba(15,23,42,0.28)', border: '1px solid rgba(255,255,255,0.18)',
          }}>
            <Typography sx={{
              fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
            }}>
              Waiting
            </Typography>
            <Typography sx={{
              fontFamily: 'var(--font-outfit), "Outfit", system-ui, sans-serif', fontSize: 'clamp(1.5rem, 2.4vw, 1.9rem)', fontWeight: 800, mt: 0.25, lineHeight: 1.15,
            }}>
              {totalWaiting > 0 ? totalWaiting : <Box component="span" sx={{ opacity: 0.55, fontSize: '0.95rem' }}>Clear</Box>}
            </Typography>
          </Box>
          <Box sx={{
            textAlign: 'center', px: 0.5, py: 0.75, borderRadius: '12px',
            bgcolor: 'rgba(15,23,42,0.28)', border: '1px solid rgba(255,255,255,0.18)',
          }}>
            <Typography sx={{
              fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
            }}>
              Next
            </Typography>
            <Typography sx={{
              fontFamily: 'var(--font-outfit), "Outfit", system-ui, sans-serif', fontSize: 'clamp(1.5rem, 2.4vw, 1.9rem)', fontWeight: 800, mt: 0.25, lineHeight: 1.15,
            }}>
              {nextNum || '—'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
