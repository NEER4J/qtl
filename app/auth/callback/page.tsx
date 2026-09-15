import { redirect } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function AuthCallback({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const code = first(params.code)
  const tokenHash = first(params.token_hash)
  const type = first(params.type) as EmailOtpType | undefined
  // Only same-site paths — never bounce to an arbitrary URL from a link.
  const rawNext = first(params.next) ?? '/dashboard'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'
  const failTo =
    next === '/auth/reset-password' ? '/auth/reset-password' : '/auth/login?error=callback_error'

  if (tokenHash && type) {
    // Email links built from the template's {{ .TokenHash }} — these work in
    // any browser, unlike `code`, which only the browser that asked can use.
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) {
      console.error('auth callback: verifyOtp failed:', error.message)
      redirect(failTo)
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('auth callback: code exchange failed:', error.message)
      redirect(failTo)
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(next === '/auth/reset-password' ? failTo : '/auth/login?error=session_missing')

  redirect(next)
}
