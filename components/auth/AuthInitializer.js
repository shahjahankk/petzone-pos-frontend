'use client'

import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { initializeAuth } from '../../app/store/slices/authSlice'

// Dispatches initializeAuth once on app startup to hydrate auth state
// from localStorage. This is the ONLY place initializeAuth should be called.
const AuthInitializer = () => {
  const dispatch = useDispatch()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    dispatch(initializeAuth())
    initialized.current = true
  }, [dispatch])

  return null
}

export default AuthInitializer