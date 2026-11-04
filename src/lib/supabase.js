import { createClient } from '@supabase/supabase-js'

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (typeof process !== 'undefined' ? process.env : {})
const rawUrl = env.VITE_SUPABASE_URL || ''
export const supabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
export const supabaseAnonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseAnonKey !== 'your_supabase_publishable_anon_key_here'
)

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  console.warn(
    '[Assignora] Supabase credentials missing or set to placeholder in .env file. ' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are configured in your .env file.'
  )
}

// Create the Supabase client with persistSession enabled for localStorage
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
)
