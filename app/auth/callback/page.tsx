import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AuthCallback({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  console.log('OAuth callback received params:', params)

  const code = Array.isArray(params.code) ? params.code[0] : params.code
  const next = Array.isArray(params.next) ? params.next[0] : params.next ?? '/dashboard'

  console.log('Code:', code, 'Next:', next)

  if (code) {
    console.log('Exchanging code for session...')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('OAuth callback error:', error)
      redirect('/auth/login?error=callback_error')
    }
    
    console.log('Session exchange successful:', data)
  } else {
    console.log('No code provided, checking existing session...')
    // No code provided, check if user is already authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('No code provided and no existing session:', userError)
      redirect('/auth/login?error=no_code')
    }
    
    console.log('Existing user found:', user)
  }

  // Get the user after the session exchange
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    console.error('User fetch error:', userError)
    redirect('/auth/login?error=session_missing')
  }

  console.log('Redirecting to:', next)
  redirect(next as string)
}
