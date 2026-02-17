import { createSlice } from '@reduxjs/toolkit'

const scopeSlice = createSlice({
  name: 'scope',
  initialState: {
    scopeType: null, // BRANCH or WAREHOUSE
    scopeId: null
  },
  reducers: {
    setScope: (state, action) => {
      state.scopeType = action.payload.scopeType
      state.scopeId = action.payload.scopeId
    },
    clearScope: (state) => {
      state.scopeType = null
      state.scopeId = null
    }
  }
})

export const { setScope, clearScope } = scopeSlice.actions
export default scopeSlice.reducer
