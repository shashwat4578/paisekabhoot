import { useState } from 'react'
import { supabase } from '../api/supabaseClient'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Registration successful! Please check your email for verification.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '80vh'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '32px' }}>
        <div className="app-logo" style={{ marginBottom: '24px', justifyContent: 'center' }}>
          <div className="app-logo-icon">₹</div>
          <span className="app-logo-text">PaisekaBhoot Login</span>
        </div>
        
        <form onSubmit={handleAuth}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input 
              className="form-input" 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              placeholder="you@example.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              className="form-input" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required
              placeholder="••••••••"
            />
          </div>
          
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={loading}>
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        {message && (
          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            borderRadius: '8px', 
            fontSize: '13px',
            backgroundColor: message.includes('success') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: message.includes('success') ? 'var(--color-success)' : 'var(--color-danger)',
            border: '1px solid currentColor'
          }}>
            {message}
          </div>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px' }}>
          <span className="text-dim">
            {isSignUp ? 'Already have an account?' : 'New to PaisekaBhoot?'}
          </span>
          <button 
            className="btn-text" 
            style={{ marginLeft: '8px', color: 'var(--color-primary)', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
