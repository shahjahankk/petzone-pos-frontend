'use client'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }) {
  useEffect(() => {}, [error])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', padding: '24px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '6rem', fontWeight: 700, color: '#e53e3e', margin: 0 }}>500</h1>
      <p style={{ color: '#666', fontSize: '1.25rem', margin: 0 }}>Something went wrong</p>
      <p style={{ color: '#999', fontSize: '0.875rem', margin: 0 }}>{error?.message || 'An unexpected error occurred'}</p>
      <button onClick={reset} style={{ background: '#6b46c1', color: '#fff', padding: '10px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>
        Try Again
      </button>
    </div>
  )
}
