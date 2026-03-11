'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSelector, useDispatch } from 'react-redux'
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material'
import { usePermissions } from '../../hooks/usePermissions'
import { fetchBranchSettings } from '../../app/store/slices/branchesSlice'

/**
 * RouteGuard — page-level wrapper for role and permission checks.
 * Sits inside RouteProtection, which already handles the auth redirect.
 *
 * @param {React.ReactNode} props.children
 * @param {string|string[]} props.allowedRoles       - Role(s) that can access this route
 * @param {string}          props.requiredPermission - Specific permission required
 * @param {boolean}         props.requireAuth        - Must be authenticated (default: true)
 * @param {boolean}         props.loadBranchSettings - Load branch settings on mount (default: false)
 */
const RouteGuard = ({
  children,
  allowedRoles,
  requiredPermission,
  requireAuth = true,
  loadBranchSettings = false,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useDispatch()

  // FIX: added authInitialized to selector
  const { user, isAuthenticated, isLoading, authInitialized } = useSelector(
    (state) => state.auth
  )
  const { branchSettings, isLoading: branchLoading } = useSelector(
    (state) => state.branches
  )

  const { hasRoleHierarchy, hasPermission, canAccessPath } = usePermissions()

  useEffect(() => {
    // FIX: don't act until auth has been initialized from localStorage.
    // Old code used `!isAuthenticated && !isLoading` which fired immediately
    // on first render before initializeAuth had run.
    if (!authInitialized || isLoading) return

    if (requireAuth && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (loadBranchSettings && isAuthenticated && user?.branchId && !branchSettings && user?.role !== 'CASHIER') {
      dispatch(fetchBranchSettings(user.branchId))
    }
  }, [
    authInitialized,
    isAuthenticated,
    isLoading,
    requireAuth,
    loadBranchSettings,
    user?.branchId,
    user?.role,
    branchSettings,
    dispatch,
    router,
  ])

  // Wait for auth initialization and any in-flight login request
  if (!authInitialized || (requireAuth && isLoading)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Checking authentication...</Typography>
      </Box>
    )
  }

  // Wait for branch settings to load
  if (loadBranchSettings && branchLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading branch settings...</Typography>
      </Box>
    )
  }

  // Path-level access check
  if (requireAuth && isAuthenticated && !canAccessPath(pathname)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          }
        >
          You don&apos;t have permission to access this page.
        </Alert>
      </Box>
    )
  }

  // Role-based access check
  if (allowedRoles && !hasRoleHierarchy(allowedRoles)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          }
        >
          Your role doesn&apos;t have access to this page.
        </Alert>
      </Box>
    )
  }

  // Specific permission check
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          }
        >
          You don&apos;t have the required permission for this page.
        </Alert>
      </Box>
    )
  }

  return children
}

export default RouteGuard