'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'
import type { AuthContextType, AuthUser } from '@/types/auth'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function baseUserFromAuth(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name,
    avatar: user.user_metadata?.avatar_url,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const loadProfile = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setUser(null)
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('role, location_id, can_enter_expenses, active, full_name')
      .eq('id', authUser.id)
      .maybeSingle()

    if (error) {
      console.error('auth: failed to load profile', error.message)
      setUser(baseUserFromAuth(authUser))
      return
    }

    setUser({
      ...baseUserFromAuth(authUser),
      name: data?.full_name || baseUserFromAuth(authUser).name,
      role: data?.role,
      locationId: data?.location_id ?? null,
      canEnterExpenses: data?.can_enter_expenses ?? false,
      active: data?.active ?? true,
    })
  }, [])

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      await loadProfile(session?.user ?? null)
      setLoading(false)
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session: Session | null) => {
      await loadProfile(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const signIn = async (identifier: string, password: string) => {
    const supabase = createClient()

    // Accept either an email or a username. If the input contains no `@`,
    // we treat it as a username and resolve it to the underlying auth email
    // via the SECURITY DEFINER RPC (see 0059_username_and_permissions.sql).
    let email = identifier.trim()
    if (!email.includes('@')) {
      const { data, error } = await supabase.rpc('auth_email_for_username', {
        p_username: email.toLowerCase(),
      })
      if (error || !data) {
        return { error: 'Invalid username or password' }
      }
      email = data as string
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message || null }
  }

  const signUp = async (email: string, password: string) => {
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message || null }
  }

  const signInWithGoogle = async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    return { error: error?.message || null }
  }

  const signOut = async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    return { error: error?.message || null }
  }

  const resetPassword = async (email: string) => {
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    return { error: error?.message || null }
  }

  const updatePassword = async (password: string) => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error?.message || null }
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

  if (!mounted) {
    return (
      <AuthContext.Provider
        value={{
          user: null,
          loading: true,
          error: null,
          signIn: async () => ({ error: null }),
          signUp: async () => ({ error: null }),
          signInWithGoogle: async () => ({ error: null }),
          signOut: async () => ({ error: null }),
          resetPassword: async () => ({ error: null }),
          updatePassword: async () => ({ error: null }),
        }}
      >
        {children}
      </AuthContext.Provider>
    )
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
