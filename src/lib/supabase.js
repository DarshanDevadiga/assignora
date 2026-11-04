import { createClient } from '@supabase/supabase-js'

let rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://trkcagoxopabqerljgvn.supabase.co'
// Sanitize URL to ensure it is the root project URL
let cleanUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(
  cleanUrl && 
  supabaseAnonKey && 
  supabaseAnonKey !== 'your_supabase_publishable_anon_key_here'
)

if (!isSupabaseConfigured) {
  console.warn(
    '[Assignora] Supabase credentials missing or set to placeholder in .env file. ' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are configured.'
  )
}

// Create the Supabase client with persistSession enabled for localStorage
export const supabase = createClient(
  cleanUrl || 'https://trkcagoxopabqerljgvn.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window?.localStorage,
    },
  }
)
