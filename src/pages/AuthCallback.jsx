import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  GraduationCap,
  Sparkles,
  Loader2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { authService } from '../services/auth.service'
import { useAuth } from '../context/AuthContext'
import Button from '../components/common/Button'
import Card from '../components/common/Card'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()

  const [status, setStatus] = useState('verifying') // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('Verifying your email address and establishing secure session...')
  const [targetRole, setTargetRole] = useState('student')

  useEffect(() => {
    let isMounted = true

    async function handleAuthVerification() {
      try {
        // 1. Check for error parameters returned by Supabase Auth
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')
        if (error || errorDescription) {
          if (isMounted) {
            setStatus('error')
            setMessage(
              errorDescription ||
              'This verification link is invalid, expired, or has already been used. Please sign in or request a new confirmation email.'
            )
          }
          return
        }

        // 2. Check for PKCE Authorization Code
        const code = searchParams.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            console.error('[AuthCallback] Code exchange failed:', exchangeError)
            if (isMounted) {
              setStatus('error')
              setMessage(exchangeError.message || 'Verification token exchange failed.')
            }
            return
          }
        }

        // 3. Check for Token Hash verification (OTP / Token Hash flow)
        const tokenHash = searchParams.get('token_hash')
        const type = searchParams.get('type')
        if (tokenHash && type) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type || 'signup',
          })
          if (otpError) {
            console.error('[AuthCallback] Token hash verification failed:', otpError)
            if (isMounted) {
              setStatus('error')
              setMessage(otpError.message || 'Email verification failed.')
            }
            return
          }
        }

        // 4. Retrieve established session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (!session?.user) {
          // If detectSessionInUrl hasn't settled yet, wait briefly and retry once
          await new Promise((res) => setTimeout(res, 500))
          const { data: retryData } = await supabase.auth.getSession()
          if (!retryData?.session?.user) {
            if (isMounted) {
              setStatus('error')
              setMessage('No active session was found. Please sign in with your email and password.')
            }
            return
          }
        }

        // 5. Fetch (or self-heal provision) verified user profile to determine correct role dashboard
        const currentSession = session || (await supabase.auth.getSession()).data.session
        const userId = currentSession.user.id
        const profile = await authService.getUserProfile(userId, true)

        if (!profile || !profile.role) {
          throw new Error('Verified user profile could not be established. Please sign in or contact support.')
        }

        const role = profile.role
        if (isMounted) {
          setTargetRole(role)
          setStatus('success')
          setMessage('Email confirmed successfully! Welcome to Assignora.')
        }

        // Refresh global AuthContext
        if (refreshProfile) {
          await refreshProfile()
        }

        // Redirect to role dashboard after a brief confirmation moment
        setTimeout(() => {
          if (isMounted) {
            navigate(role === 'admin' ? '/admin' : '/student', { replace: true })
          }
        }, 1200)
      } catch (err) {
        console.error('[AuthCallback] Unexpected verification error:', err)
        if (isMounted) {
          setStatus('error')
          setMessage(err.message || 'An unexpected error occurred during email verification.')
        }
      }
    }

    handleAuthVerification()

    return () => {
      isMounted = false
    }
  }, [searchParams, navigate, refreshProfile])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FF] via-[#F5F3FF] to-[#EDE9FE] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow backgrounds */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-brand-light/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-brand-border/40 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Card className="text-center p-6 sm:p-8 shadow-card border border-brand-line/80">
          {/* Brand header */}
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center shadow-purple-glow">
              <GraduationCap className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black text-brand-heading tracking-tight">Assignora</span>
          </div>

          {/* Verifying State */}
          {status === 'verifying' && (
            <div className="space-y-4 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-purple-50 flex items-center justify-center text-brand-primary">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h2 className="text-lg font-bold text-brand-heading">Verifying Your Email</h2>
              <p className="text-xs sm:text-sm text-brand-muted max-w-xs mx-auto leading-relaxed">
                {message}
              </p>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="space-y-4 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-emerald-900">Email Confirmed!</h2>
              <p className="text-xs sm:text-sm text-brand-muted max-w-xs mx-auto leading-relaxed">
                {message}
              </p>
              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full font-semibold shadow-purple-glow"
                  icon={ArrowRight}
                  onClick={() => navigate(targetRole === 'admin' ? '/admin' : '/student', { replace: true })}
                >
                  Proceed to Dashboard
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="space-y-4 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-rose-900">Verification Link Issue</h2>
              <p className="text-xs sm:text-sm text-rose-700 bg-rose-50/60 p-3 rounded-xl border border-rose-100 leading-relaxed text-left">
                {message}
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Link to="/login" className="flex-1">
                  <Button variant="primary" className="w-full text-xs">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register" className="flex-1">
                  <Button variant="secondary" className="w-full text-xs">
                    Register
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
