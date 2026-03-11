import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authAPI } from '../../../utils/axios'

// Async thunks for API calls
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(email, password)
      const { accessToken, refreshToken, user } = response.data.data
      authAPI.setTokens(accessToken, refreshToken)
      localStorage.setItem('user', JSON.stringify(user))
      return { accessToken, refreshToken, user }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Login failed')
    }
  }
)

// FIX: renamed from `refreshToken` to `refreshAccessToken` to avoid collision
// with the `refreshToken` state field
export const refreshAccessToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authAPI.refreshAccessToken()
      const { accessToken, refreshToken } = response.data.data
      authAPI.setTokens(accessToken, refreshToken)
      return { accessToken, refreshToken }
    } catch (error) {
      authAPI.clearTokens()
      return rejectWithValue(error.response?.data?.message || error.message || 'Token refresh failed')
    }
  }
)

const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  authInitialized: false, // guards against redirect before localStorage is read
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      authAPI.clearTokens()
      state.user = null
      state.token = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.authInitialized = true // stay initialized after logout
      state.error = null
    },
    clearError: (state) => {
      state.error = null
    },
    initializeAuth: (state) => {
      // FIX: removed the broken isLoading guard — it never worked because
      // this reducer is synchronous (isLoading never persists between calls)
      // authInitialized guard is the correct dedup mechanism
      if (state.authInitialized) {
        return
      }

      if (typeof window === 'undefined') {
        state.authInitialized = true
        return
      }

      try {
        const accessToken = localStorage.getItem('accessToken')
        const refreshToken = localStorage.getItem('refreshToken')
        const userData = localStorage.getItem('user')

        if (accessToken && refreshToken && userData) {
          const user = JSON.parse(userData)
          state.token = accessToken
          state.refreshToken = refreshToken
          state.user = user
          state.isAuthenticated = true
        } else {
          state.isAuthenticated = false
          state.user = null
          state.token = null
          state.refreshToken = null
        }
      } catch (error) {
        authAPI.clearTokens()
        state.isAuthenticated = false
        state.user = null
        state.token = null
        state.refreshToken = null
      }

      // FIX: isLoading was set true then false in same call — UI never saw it.
      // Removed. initializeAuth is synchronous so no loading state needed.
      state.authInitialized = true
    },
    setUser: (state, action) => {
      state.user = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = true
        state.token = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
        state.user = action.payload.user
        state.authInitialized = true
        state.error = null
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = false
        state.error = action.payload
      })

      // Refresh Token — FIX: updated to use renamed thunk `refreshAccessToken`
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.token = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
        state.isAuthenticated = true
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        state.isAuthenticated = false
        state.token = null
        state.refreshToken = null
        state.user = null
      })
  },
})

export const { logout, clearError, initializeAuth, setUser } = authSlice.actions
export default authSlice.reducer