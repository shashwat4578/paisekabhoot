import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { upsertProfile } from '../lib/auth'

// This page handles the redirect back from Google (or any OAuth provider).
// Supabase detects the code/token in the URL and exchanges it for a session.
// Route: /auth/callback
export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    async function handleCallback() {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        console.error('OAuth callback error:', error)
        navigate('/login?error=oauth_failed', { replace: true })
        return
      }

      const user = session.user

      // Upsert profile — safe for both new and returning Google users
      try {
        await upsertProfile(user.id, {
          full_name: user.user_metadata?.full_name || user.email.split('@')[0],
          email: user.email,
          avatar_url: user.user_metadata?.avatar_url || null,
        })
      } catch (err) {
        console.warn('Profile upsert failed (non-fatal):', err.message)
      }

      navigate('/dashboard', { replace: true })
    }

    handleCallback()
  }, [navigate])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0a0f1a',
      color: '#3ecf8e',
      fontSize: 15,
      fontFamily: 'system-ui, sans-serif',
    }}>
      Completing sign-in…
    </div>
  )
}
