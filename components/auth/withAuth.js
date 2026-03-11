'use client'

import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import { Box, CircularProgress, Typography } from '@mui/material'

export default function withAuth(WrappedComponent) {
  return function AuthenticatedComponent(props) {
    const router = useRouter()
    const { isAuthenticated, isLoading, token, authInitialized } = useSelector(
      (state) => state.auth
    )

    useEffect(() => {
      // FIX: wait for authInitialized before deciding to redirect.
      // Without this, the initial Redux state (isAuthenticated=false) causes
      // an immediate redirect to /login before localStorage has been read.
      if (!authInitialized) return

      if (!isAuthenticated && !token) {
        router.push('/login')
      }
    }, [authInitialized, isAuthenticated, token, router])

    // FIX: show spinner only while auth hasn't been initialized yet,
    // or while a login request is in flight.
    // Removes the flash-of-spinner on every navigation for logged-in users.
    if (!authInitialized || isLoading) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: 2,
          }}
        >
          <CircularProgress size={60} />
          <Typography variant="h6" color="textSecondary">
            Checking authentication...
          </Typography>
        </Box>
      )
    }

    // Auth is initialized but user is not authenticated — redirect is in flight
    if (!isAuthenticated) {
      return null
    }

    return <WrappedComponent {...props} />
  }
}