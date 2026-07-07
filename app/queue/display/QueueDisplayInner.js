'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Box, Typography, Grid, Paper } from '@mui/material'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

async function fetchStatus(org, branch) {
  const res = await fetch(`${API_BASE}/queue/public/${org}/${branch}/status`)
  const json = await res.json()
  if (!json.success) throw new Error(json.message)
  return json.data
}

export default function QueueDisplayInner() {
  const searchParams = useSearchParams()
  const org = searchParams.get('org') || 'petzone'
  const branch = searchParams.get('branch') || 'main'

  const [data, setData] = useState(null)
  const [clock, setClock] = useState('')
  const [error, setError] = useState(null)

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
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [org, branch])

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0f172a 0%, #1e3a8a 100%)',
      color: '#fff', p: 4,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h3" fontWeight={800}>PetZone Clinic</Typography>
          <Typography variant="h6" sx={{ opacity: 0.7 }}>{data?.branch?.name || 'Queue Display'}</Typography>
        </Box>
        <Typography variant="h4" sx={{ opacity: 0.9 }}>{clock}</Typography>
      </Box>

      {error && <Typography color="error.light" sx={{ mb: 2 }}>{error}</Typography>}

      <Typography variant="h5" sx={{ mb: 2, opacity: 0.9 }}>Now Serving</Typography>
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {(data?.now_serving || []).length === 0 ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
              <Typography variant="h2" sx={{ opacity: 0.5 }}>—</Typography>
              <Typography>Please wait</Typography>
            </Paper>
          </Grid>
        ) : (
          (data.now_serving || []).map((s, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', border: '2px solid rgba(255,255,255,0.2)' }}>
                <Typography variant="body1" sx={{ opacity: 0.7 }}>{s.service_name}</Typography>
                <Typography variant="h1" fontWeight={900} sx={{ color: '#ffb6c1', fontSize: '6rem', lineHeight: 1 }}>{s.ticket_code}</Typography>
                <Typography variant="h6" sx={{ opacity: 0.8, mt: 1 }}>{s.counter_name || 'Please proceed'}</Typography>
              </Paper>
            </Grid>
          ))
        )}
      </Grid>

      <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Waiting Queue</Typography>
        {(data?.waiting_by_service || []).map((w) => (
          <Box key={w.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="h6">{w.name} <span style={{ opacity: 0.5, fontSize: 14 }}>({w.waiting_count} waiting)</span></Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color: '#ffb6c1' }}>{w.next_ticket || '—'}</Typography>
          </Box>
        ))}
      </Paper>
    </Box>
  )
}
