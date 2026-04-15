'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthContextType, AuthUser } from '@/types/auth'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Only create client on the client side
    const supabase = createClient()
    
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(transformUser(session.user))
      }
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(transformUser(session.user))
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const transformUser = (user: any): AuthUser => ({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name,
    avatar: user.user_metadata?.avatar_url,
    role: user.user_metadata?.role || 'user'
  })

  const signIn = async (email: string, password: string) => {
    try {
      setError(null)
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error: error?.message || null }
    } catch (err) {
      return { error: 'An unexpected error occurred' }
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      setError(null)
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      return { error: error?.message || null }
    } catch (err) {
      return { error: 'An unexpected error occurred' }
    }
  }

  const signInWithGoogle = async () => {
    try {
      setError(null)
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      return { error: error?.message || null }
    } catch (err) {
      return { error: 'An unexpected error occurred' }
    }
  }

  const signOut = async () => {
    try {
      setError(null)
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      return { error: error?.message || null }
    } catch (err) {
      return { error: 'An unexpected error occurred' }
    }
  }

  const resetPassword = async (email: string) => {
    try {
      setError(null)
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      return { error: error?.message || null }
    } catch (err) {
      return { error: 'An unexpected error occurred' }
    }
  }

  const updatePassword = async (password: string) => {
    try {
      setError(null)
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password
      })
      return { error: error?.message || null }
    } catch (err) {
      return { error: 'An unexpected error occurred' }
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
  }

  // During SSR, don't access any uncached data
  if (!mounted) {
    return <AuthContext.Provider value={{ user: null, loading: true, error: null, signIn: async () => ({ error: null }), signUp: async () => ({ error: null }), signInWithGoogle: async () => ({ error: null }), signOut: async () => ({ error: null }), resetPassword: async () => ({ error: null }), updatePassword: async () => ({ error: null }) }}>{children}</AuthContext.Provider>
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
