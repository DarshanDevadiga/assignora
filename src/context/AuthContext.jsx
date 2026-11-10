import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react'
import { authService } from '../services/auth.service'

const AuthContext = createContext(null)
const CACHE_KEY = 'assignora_cached_profile'

function getInitialCachedAuth() {
  if (typeof window === 'undefined') return { user: null, profile: null }
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { user: parsed.user || null, profile: parsed.profile || null }
    }
  } catch (err) {
    console.warn('[AuthContext] Failed reading cached session:', err)
  }
  return { user: null, profile: null }
}

export function AuthProvider({ children }) {
  const initial = useMemo(() => getInitialCachedAuth(), [])
  const [authUser, setAuthUser] = useState(initial.user)
  const [profile, setProfile] = useState(initial.profile)
  // If we have a cached user and profile, we can immediately show the shell without blocking
  const [loading, setLoading] = useState(!initial.user || !initial.profile)
  const [error, setError] = useState(null)

  const profileRef = useRef(initial.profile)
  const authUserRef = useRef(initial.user)

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  useEffect(() => {
    authUserRef.current = authUser
  }, [authUser])

  // Initialize auth state and restore session in background
  useEffect(() => {
    let isMounted = true

    async function initAuth() {
      try {
        const session = await authService.getSession()
        if (session?.user && isMounted) {
          setAuthUser(session.user)
          // If we already have the profile for this user cached, don't block
          if (!profileRef.current || profileRef.current.id !== session.user.id) {
            const userProfile = await authService.getUserProfile(session.user.id)
            if (isMounted) {
              setProfile(userProfile)
              try {
                localStorage.setItem(
                  CACHE_KEY,
                  JSON.stringify({ user: session.user, profile: userProfile })
                )
              } catch (e) {}
            }
          }
        } else if (!session && isMounted) {
          setAuthUser(null)
          setProfile(null)
          try {
            localStorage.removeItem(CACHE_KEY)
          } catch (e) {}
        }
      } catch (err) {
        console.error('[AuthContext] Session restoration error:', err)
        if (isMounted) setError(err.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initAuth()

    // Listen for auth state changes
    const { data: authListener } = authService.onAuthStateChange(async (event, session) => {
      if (!isMounted) return

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setAuthUser(session.user)
          // Only fetch if profile is not already loaded or belongs to another user
          if (!profileRef.current || profileRef.current.id !== session.user.id) {
            const userProfile = await authService.getUserProfile(session.user.id)
            if (isMounted) {
              setProfile(userProfile)
              try {
                localStorage.setItem(
                  CACHE_KEY,
                  JSON.stringify({ user: session.user, profile: userProfile })
                )
              } catch (e) {}
            }
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(null)
        setProfile(null)
        authService.clearProfileCache()
        try {
          localStorage.removeItem(CACHE_KEY)
        } catch (e) {}
      }
    })

    return () => {
      isMounted = false
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe()
      }
    }
  }, [])

  const signIn = async (email, password) => {
    setError(null)
    const result = await authService.signIn(email, password)
    setAuthUser(result.user)
    setProfile(result.profile)
    setLoading(false)
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ user: result.user, profile: result.profile })
      )
    } catch (e) {}
    return result
  }

  const signUp = async (payload) => {
    setError(null)
    const result = await authService.signUp(payload)
    if (result.session && result.user) {
      setAuthUser(result.user)
      setProfile(result.profile)
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ user: result.user, profile: result.profile })
        )
      } catch (e) {}
    }
    return result
  }

  const signOut = async () => {
    setError(null)
    authService.clearProfileCache()
    // Synchronously purge state & localStorage so UI responds with zero lag
    setAuthUser(null)
    setProfile(null)
    try {
      localStorage.removeItem(CACHE_KEY)
    } catch (e) {}

    // Run remote sign out in background
    authService.signOut().catch((err) => {
      console.warn('[AuthContext] Background signout warning:', err)
    })
  }

  const refreshProfile = async () => {
    if (!authUser?.id) return null
    try {
      const updatedProfile = await authService.getUserProfile(authUser.id)
      setProfile(updatedProfile)
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ user: authUser, profile: updatedProfile })
        )
      } catch (e) {}
      return updatedProfile
    } catch (err) {
      console.error('[AuthContext] Error refreshing profile:', err)
      return null
    }
  }

  // Combined user object for application consumption
  const user = useMemo(() => {
    if (!authUser) return null
    return {
      id: authUser.id,
      email: authUser.email,
      name: profile?.name || authUser.user_metadata?.name || authUser.email?.split('@')[0],
      role: profile?.role || 'student', // default student if profile not yet loaded
      avatar: profile?.avatar || null,
      student_id: profile?.student_id || null,
      rawAuth: authUser,
      profile,
    }
  }, [authUser, profile])

  const value = {
    user,
    authUser,
    profile,
    role: user?.role || null,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
