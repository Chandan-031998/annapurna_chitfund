import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { authService } from '../../services/authService'
import { AuthUser, Role } from '../../types/auth.types'

interface AuthState {
  user: AuthUser | null
  token: string | null
  loading: boolean
  error: string | null
}

function clearAuthStorage() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  clearLegacyAuthStorage()
}

function clearLegacyAuthStorage() {
  localStorage.removeItem('annapurna_token')
  localStorage.removeItem('annapurna_user')
}

function persistAuth(user: AuthUser, token: string) {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
  clearLegacyAuthStorage()
}

function readStoredUser() {
  const storedUser = localStorage.getItem('user')
  if (!storedUser) return null

  try {
    return JSON.parse(storedUser) as AuthUser
  } catch {
    clearAuthStorage()
    return null
  }
}

clearLegacyAuthStorage()

const initialState: AuthState = {
  user: readStoredUser(),
  token: localStorage.getItem('token'),
  loading: false,
  error: null
}

export const loginUser = createAsyncThunk('auth/login', async (payload: { email: string; password: string }) => {
  return authService.login(payload.email, payload.password)
})

export const registerUser = createAsyncThunk('auth/register', async (payload: { name: string; email: string; phone?: string; password: string; role: Role }) => {
  return authService.register(payload)
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null
      state.token = null
      clearAuthStorage()
    },
    setCredentials(state, action: PayloadAction<{ user: AuthUser; token: string }>) {
      state.user = action.payload.user
      state.token = action.payload.token
      persistAuth(action.payload.user, action.payload.token)
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
        persistAuth(action.payload.user, action.payload.token)
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Login failed'
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.user = action.payload.user
        state.token = action.payload.token
        persistAuth(action.payload.user, action.payload.token)
      })
  }
})

export const { logout, setCredentials } = authSlice.actions
export default authSlice.reducer
