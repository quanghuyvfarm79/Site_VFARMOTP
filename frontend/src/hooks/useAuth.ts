import { useState, useCallback } from 'react'
import { authAPI } from '../services/api'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  apiKey: string | null
}

function loadState(): AuthState {
  try {
    return {
      user: JSON.parse(localStorage.getItem('user') || 'null'),
      token: localStorage.getItem('token'),
      apiKey: localStorage.getItem('api_key'),
    }
  } catch {
    return { user: null, token: null, apiKey: null }
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(loadState)

  const login = useCallback(async (email: string, password: string) => {
    const res = await authAPI.login(email, password)
    const { token, user } = res.data
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setState(s => ({ ...s, token, user }))
    // Restore API key from server after login
    try {
      const keyRes = await authAPI.getCurrentAPIKey()
      const key = keyRes.data.api_key
      if (key) {
        localStorage.setItem('api_key', key)
        setState(s => ({ ...s, apiKey: key }))
      }
    } catch { /* ignore */ }
    return user
  }, [])

  const logout = useCallback(() => {
    localStorage.clear()
    setState({ user: null, token: null, apiKey: null })
    window.location.href = '/login'
  }, [])

  const generateAPIKey = useCallback(async () => {
    const res = await authAPI.generateAPIKey()
    const key = res.data.api_key
    localStorage.setItem('api_key', key)
    setState(s => ({ ...s, apiKey: key }))
    return key
  }, [])

  const updateBalance = useCallback((balance: number) => {
    setState(s => {
      if (!s.user) return s
      const user = { ...s.user, balance }
      localStorage.setItem('user', JSON.stringify(user))
      return { ...s, user }
    })
  }, [])

  return {
    user: state.user,
    token: state.token,
    apiKey: state.apiKey,
    isAuthenticated: !!state.token,
    isAdmin: state.user?.role === 'admin',
    login,
    logout,
    generateAPIKey,
    updateBalance,
  }
}
