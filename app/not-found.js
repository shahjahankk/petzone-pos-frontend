'use client'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', padding: '24px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '6rem', fontWeight: 700, color: '#6b46c1', margin: 0 }}>404</h1>
      <p style={{ color: '#666', fontSize: '1.25rem', margin: 0 }}>Page not found</p>
      <Link href="/dashboard" style={{ background: '#6b46c1', color: '#fff', padding: '10px 24px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>
        Go to Dashboard
      </Link>
    </div>
  )
}
