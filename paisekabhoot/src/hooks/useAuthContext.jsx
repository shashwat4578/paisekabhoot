import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChange, getCurrentSession, getUserProfile } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true) // true until first session check completes

  useEffect(() => {
    // Immediately check for existing session (e.g. page refresh)
    getCurrentSession().then(async (session) => {
      if (session?.user) {
        setUser(session.user)
        try {
          const p = await getUserProfile(session.user.id)
          setProfile(p)
        } catch {
          setProfile(null)
        }
      }
      setLoading(false)
    })

    // Subscribe to future auth changes
    const sub = onAuthStateChange((event, session, profile) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null)
        setProfile(profile)
      }
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
      }
      if (event === 'USER_UPDATED') {
        setUser(session?.user ?? null)
      }
    })

    return () => sub.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook for consuming auth state anywhere in the app
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
