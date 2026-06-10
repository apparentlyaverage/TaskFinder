// frontend/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { auth as authApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('tf_token')
    const saved = localStorage.getItem('tf_user')
    if (token && saved) {
      try {
        const parsedUser = JSON.parse(saved)
        setUser(parsedUser)
      } catch {
        localStorage.clear()
      }
    }
    setLoading(false)
  }, [])

  // Regular email/password login
  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login({ email, password })
    localStorage.setItem('tf_token', data.token)
    localStorage.setItem('tf_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  // Google OAuth login — redirects to backend, no API call
  const loginWithGoogle = useCallback(() => {
    // Redirect to backend Google OAuth endpoint
    const backendUrl = process.env.REACT_APP_AUTH_URL || 'http://localhost:3001'
    window.location.href = `${backendUrl}/auth/google`
  }, [])

  // Register with email/password
  const register = useCallback(async (payload) => {
    const { data } = await authApi.register(payload)
    localStorage.setItem('tf_token', data.token)
    localStorage.setItem('tf_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  // Logout
  const logout = useCallback(async () => {
    // Optional: Call backend logout to clear session
    const token = localStorage.getItem('tf_token')
    if (token) {
      try {
        await authApi.logout()
      } catch (err) {
        console.error('[logout] API error:', err)
      }
    }
    localStorage.removeItem('tf_token')
    localStorage.removeItem('tf_user')
    setUser(null)
  }, [])

  // Handle OAuth callback (called from the callback page/route)
  const handleOAuthCallback = useCallback((urlParams) => {
    const token = urlParams.get('token')
    const userId = urlParams.get('userId')
    const email = urlParams.get('email')
    const role = urlParams.get('role')

    if (!token || !userId) {
      console.error('[OAuth] Missing token or userId in callback')
      return false
    }

    const userData = {
      userId,
      email: decodeURIComponent(email),
      role: role || 'earner',
      authProvider: 'google'
    }

    localStorage.setItem('tf_token', token)
    localStorage.setItem('tf_user', JSON.stringify(userData))
    setUser(userData)
    return true
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      loginWithGoogle,
      register,
      logout,
      handleOAuthCallback
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}