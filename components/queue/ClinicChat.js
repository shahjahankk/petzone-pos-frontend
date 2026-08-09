'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box, Button, Card, CardContent, FormControl, InputLabel, MenuItem, Select,
  Stack, TextField, Typography, Chip,
} from '@mui/material'
import { Send } from '@mui/icons-material'
import { getClinicChat, postClinicChat } from '../../utils/queueApi'

const PRESETS = ['Reception', 'Cashier', 'OPD 1', 'OPD 2', 'Grooming', 'OT', 'Lab', 'custom']

/**
 * Shared clinic chat for OPD / Reception / Cashier.
 * Polling only — safe for cPanel Node hosting (no websockets).
 */
export default function ClinicChat({ orgSlug, branchSlug, defaultSender = 'Reception' }) {
  const storageKey = `pos-clinic-chat-${orgSlug}-${branchSlug}`
  const [mode, setMode] = useState(defaultSender)
  const [customName, setCustomName] = useState('')
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [status, setStatus] = useState('Connecting…')
  const [sending, setSending] = useState(false)
  const lastIdRef = useRef(0)
  const boxRef = useRef(null)
  const initialRef = useRef(true)

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}')
      if (saved.mode && PRESETS.includes(saved.mode)) setMode(saved.mode)
      else if (defaultSender) setMode(defaultSender)
      if (saved.custom) setCustomName(saved.custom)
    } catch {
      /* ignore */
    }
  }, [storageKey, defaultSender])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ mode, custom: customName }))
    } catch {
      /* ignore */
    }
  }, [mode, customName, storageKey])

  const senderName = mode === 'custom' ? (customName.trim() || 'Staff') : mode

  const scrollBottom = () => {
    const el = boxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  const refresh = useCallback(async () => {
    if (!orgSlug || !branchSlug) return
    try {
      const sinceId = initialRef.current ? 0 : lastIdRef.current
      const rows = await getClinicChat(orgSlug, branchSlug, {
        sinceId: sinceId || undefined,
        limit: 50,
      })
      if (initialRef.current) {
        setMessages(rows)
        lastIdRef.current = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0)
        initialRef.current = false
        setTimeout(scrollBottom, 50)
      } else if (rows.length) {
        setMessages((prev) => {
          const seen = new Set(prev.map((p) => p.id))
          const merged = [...prev]
          rows.forEach((r) => {
            if (!seen.has(r.id)) merged.push(r)
            lastIdRef.current = Math.max(lastIdRef.current, Number(r.id) || 0)
          })
          return merged
        })
        setTimeout(scrollBottom, 50)
      }
      setStatus('Live')
    } catch {
      setStatus('Offline')
    }
  }, [orgSlug, branchSlug])

  useEffect(() => {
    initialRef.current = true
    lastIdRef.current = 0
    setMessages([])
    refresh()
    const id = setInterval(refresh, 3500)
    return () => clearInterval(id)
  }, [refresh])

  const send = async () => {
    const body = text.trim()
    if (!body || sending || !orgSlug || !branchSlug) return
    setSending(true)
    try {
      const row = await postClinicChat(orgSlug, branchSlug, {
        sender_name: senderName,
        sender_role: senderName,
        body,
      })
      setText('')
      if (row) {
        setMessages((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]))
        lastIdRef.current = Math.max(lastIdRef.current, Number(row.id) || 0)
        setTimeout(scrollBottom, 50)
      } else {
        await refresh()
      }
    } catch (err) {
      setStatus(err.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  if (!orgSlug || !branchSlug) return null

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="h6" fontWeight={700} color="primary">Clinic Chat</Typography>
            <Typography variant="body2" color="text.secondary">
              Shared notes for OPD, Grooming, Reception & Cashier
            </Typography>
          </Box>
          <Chip
            size="small"
            label={status}
            color={status === 'Live' ? 'success' : status === 'Offline' ? 'error' : 'default'}
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>You are</InputLabel>
            <Select label="You are" value={mode} onChange={(e) => setMode(e.target.value)}>
              {PRESETS.map((p) => (
                <MenuItem key={p} value={p}>{p === 'custom' ? 'Custom name…' : p}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Custom name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            disabled={mode !== 'custom'}
            fullWidth
            inputProps={{ maxLength: 80 }}
          />
        </Stack>

        <Box
          ref={boxRef}
          sx={{
            height: 260,
            overflowY: 'auto',
            bgcolor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            p: 1.5,
            mb: 1.5,
          }}
        >
          {messages.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              No messages yet. Example: “Token 42 — please add vaccination charge.”
            </Typography>
          ) : (
            messages.map((m) => (
              <Box key={m.id} sx={{ mb: 1.25, pb: 1, borderBottom: '1px solid #e2e8f0' }}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography variant="subtitle2" fontWeight={700} color="primary">
                    {m.sender_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {m.created_at
                      ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.body}</Typography>
              </Box>
            ))
          )}
        </Box>

        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            fullWidth
            placeholder="Type a remark for the team…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            inputProps={{ maxLength: 500 }}
          />
          <Button
            variant="contained"
            endIcon={<Send />}
            onClick={send}
            disabled={sending || !text.trim()}
          >
            Send
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
