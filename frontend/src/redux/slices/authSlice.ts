import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { authService } from '../../services/authService'
import { AuthUser } from '../../types/auth.types'

interface AuthState {
  user: AuthUser | null
  token: string | null
  loading: boolean
  error: string | null
}

const storedUser = localStorage.getItem('annapurna_user')

const initialState: AuthState = {
  user: storedUser ? JSON.parse(storedUser) : null,
  token: localStorage.getItem('annapurna_token') || localStorage.getItem('token'),
  loading: false,
  error: null
}

export const loginUser = createAsyncThunk('auth/login', async (payload: { email: string; password: string }) => {
  return authService.login(payload.email, payload.password)
})

export const registerUser = createAsyncThunk('auth/register', async (payload: { name: string; email: string; phone?: string; password: string; role: string }) => {
  return authService.register(payload)
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null
      state.token = null
      localStorage.removeItem('token')
      localStorage.removeItem('annapurna_token')
      localStorage.removeItem('annapurna_user')
    },
    setCredentials(state, action: PayloadAction<{ user: AuthUser; token: string }>) {
      state.user = action.payload.user
      state.token = action.payload.token
      localStorage.setItem('token', action.payload.token)
      localStorage.setItem('annapurna_token', action.payload.token)
      localStorage.setItem('annapurna_user', JSON.stringify(action.payload.user))
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.token = action.payload.token
        localStorage.setItem('token', action.payload.token)
        localStorage.setItem('annapurna_token', action.payload.token)
        localStorage.setItem('annapurna_user', JSON.stringify(action.payload.user))
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Login failed'
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.user = action.payload.user
        state.token = action.payload.token
        localStorage.setItem('token', action.payload.token)
        localStorage.setItem('annapurna_token', action.payload.token)
        localStorage.setItem('annapurna_user', JSON.stringify(action.payload.user))
      })
  }
})

export const { logout, setCredentials } = authSlice.actions
export default authSlice.reducer
