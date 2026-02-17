// store/slices/scopeSlice.js
import { createSlice } from '@reduxjs/toolkit'

// ============================
// SESSION STORAGE HELPERS
// ============================
const SESSION_KEY = 'app_scope'

const loadFromSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return { scopeType: null, scopeId: null }
    const parsed = JSON.parse(raw)
    // Validate shape before trusting it
    if (parsed?.scopeType && parsed?.scopeId) return parsed
    return { scopeType: null, scopeId: null }
  } catch {
    return { scopeType: null, scopeId: null }
  }
}

const saveToSession = (scopeType, scopeId) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ scopeType, scopeId }))
  } catch {
    // sessionStorage unavailable (SSR, private mode, etc.) — fail silently
  }
}

const clearFromSession = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {}
}

// ============================
// SLICE
// ============================
const scopeSlice = createSlice({
  name: 'scope',
  initialState: loadFromSession(), // ← rehydrate on Redux init
  reducers: {
    setScope: (state, action) => {
      const { scopeType, scopeId } = action.payload
      state.scopeType = scopeType
      state.scopeId = scopeId
      saveToSession(scopeType, scopeId) // ← persist on every change
    },
    clearScope: (state) => {
      state.scopeType = null
      state.scopeId = null
      clearFromSession() // ← wipe on logout/scope reset
    }
  }
})

export const { setScope, clearScope } = scopeSlice.actions
export default scopeSlice.reducer
