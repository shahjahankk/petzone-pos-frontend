'use client'

import React from 'react'
import { useSelector } from 'react-redux'
import { usePermissions } from '../../hooks/usePermissions'

/**
 * RoleGuard — inline conditional render based on user role.
 * Does NOT handle routing. Use RouteGuard for page-level protection.
 *
 * @param {string|string[]} props.allowedRoles    - Role(s) that can see this content
 * @param {React.ReactNode} props.children        - Rendered if user has permission
 * @param {React.ReactNode} props.fallback        - Rendered if user lacks permission (default: null)
 * @param {boolean}         props.requireAll      - User must satisfy ALL roles in list (default: false)
 *                                                  Note: since a user has one role, requireAll only
 *                                                  makes sense when allowedRoles has one entry, or
 *                                                  when combined with strict=false (hierarchy check).
 * @param {boolean}         props.strict          - Exact role match only, no hierarchy (default: false)
 */
const RoleGuard = ({
  allowedRoles,
  children,
  fallback = null,
  requireAll = false,
  strict = false,
}) => {
  const { user } = useSelector((state) => state.auth)

  // FIX: use usePermissions hook instead of duplicating hierarchy logic inline
  const { hasRoleHierarchy } = usePermissions()

  if (!user) return fallback
  if (!allowedRoles) return children

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

  const checkPermission = () => {
    if (strict) {
      // Exact match only — no hierarchy
      return requireAll
        ? roles.every(role => user.role === role)
        : roles.includes(user.role)
    }

    // FIX: requireAll with hierarchy means the user's role must satisfy every
    // entry in the list via hierarchy check, not that they must hold all roles.
    // A CASHIER satisfies requireAll: ['CASHIER'] but not requireAll: ['ADMIN','CASHIER'].
    // An ADMIN satisfies requireAll: ['ADMIN','CASHIER'] because ADMIN > CASHIER.
    if (requireAll) {
      return roles.every(role => hasRoleHierarchy(role))
    }

    // Default: user satisfies ANY of the listed roles (with hierarchy)
    return hasRoleHierarchy(roles)
  }

  return checkPermission() ? children : fallback
}

export default RoleGuard