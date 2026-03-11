'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSelector } from 'react-redux'
import { Box, Typography, CircularProgress, Button } from '@mui/material'

// Public paths that never need auth checks
const PUBLIC_PATHS = ['/login', '/register', '/download']

const RouteProtection = ({ children }) => {
  const router = useRouter()
  const pathname = usePathname()

  // FIX: removed dispatch(initializeAuth()) — AuthInitializer in the root
  // layout handles this once. Calling it here caused double-initialization
  // on every protected page mount.
  const { user, isAuthenticated, isLoading, authInitialized } = useSelector(
    (state) => state.auth
  )

  const isPublicPath = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    if (isPublicPath) return

    // FIX: wait for authInitialized before making any redirect decision.
    // Without this, the initial Redux state (isAuthenticated=false, token=null)
    // triggered an immediate redirect to /login before localStorage was read.
    if (!authInitialized || isLoading) return

    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    // Redirect root path to dashboard once authenticated
    if (pathname === '/' && isAuthenticated && user) {
      router.replace('/dashboard')
    }
  }, [pathname, isAuthenticated, isLoading, authInitialized, user, router, isPublicPath])

  // Public pages always render immediately
  if (isPublicPath) {
    return children
  }

  // FIX: removed the `!pathname.startsWith('/dashboard/')` exception that
  // allowed unauthenticated users to briefly see dashboard sub-pages.
  // Now ALL non-public paths show the spinner until auth is confirmed.
  if (!authInitialized || isLoading) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={40} />
        <Typography variant="h6">Checking authentication...</Typography>
      </Box>
    )
  }

  // Authenticated, redirect from root
  if (isAuthenticated && pathname === '/') {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={40} />
        <Typography variant="h6">
          Welcome back, {user?.username || user?.email}!
        </Typography>
        <Button variant="outlined" onClick={() => router.replace('/dashboard')} sx={{ mt: 1 }}>
          Go to Dashboard
        </Button>
      </Box>
    )
  }

  // Not authenticated — redirect is in flight
  if (!isAuthenticated) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={40} />
        <Typography variant="h6">Redirecting to login...</Typography>
      </Box>
    )
  }

  return children
}

export default RouteProtection