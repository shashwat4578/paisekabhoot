import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import {
  signUpWithEmail,
  loginWithEmail,
  loginWithGoogle,
  sendPasswordReset,
} from '../lib/auth'
import '../styles/auth.css'

export default function LoginPage() {
  const navigate = useNavigate()

  const [mode, setMode]         = useState('login')
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState({ text: '', type: '' })

  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')

  const showMsg    = (text, type) => setMsg({ text, type })
  const clearMsg   = () => setMsg({ text: '', type: '' })
  const switchMode = (m) => { setMode(m); clearMsg() }

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  async function handleLogin(e) {
    e.preventDefault()
    if (!isValidEmail(email)) { showMsg('Please enter a valid email address.', 'err'); return }
    if (!password)            { showMsg('Please enter your password.', 'err'); return }

    setLoading(true); clearMsg()
    try {
      await loginWithEmail(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err.message?.includes('Email not confirmed')) {
        showMsg('Please verify your email first. Check your inbox for the verification link.', 'err')
      } else {
        showMsg(err.message || 'Login failed. Check your credentials.', 'err')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e) {
    e.preventDefault()
    if (!fullName.trim())      { showMsg('Please enter your full name.', 'err'); return }
    if (!isValidEmail(email))  { showMsg('Please enter a valid email address.', 'err'); return }
    if (password.length < 8)   { showMsg('Password must be at least 8 characters.', 'err'); return }

    setLoading(true); clearMsg()
    try {
      await signUpWithEmail(fullName.trim(), email, password)
      setMode('verify_sent')
    } catch (err) {
      showMsg(err.message || 'Sign up failed. Try again.', 'err')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    if (!isValidEmail(email)) { showMsg('Please enter a valid email address.', 'err'); return }

    setLoading(true); clearMsg()
    try {
      await sendPasswordReset(email)
      setMode('reset_sent')
    } catch (err) {
      showMsg(err.message || 'Failed to send reset email.', 'err')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    clearMsg()
    try {
      await loginWithGoogle()
    } catch (err) {
      showMsg(err.message || 'Google sign-in failed.', 'err')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-left">
          <Logo size={42} showText={true} />
          <div className="auth-left-features">
            <p className="feature-label">Your account is protected with</p>
            <ul>
              <li><span className="feat-dot" />Email verification on signup</li>
              <li><span className="feat-dot" />Google OAuth 2.0 one-click sign-in</li>
              <li><span className="feat-dot" />Supabase Row Level Security (RLS)</li>
              <li><span className="feat-dot" />JWT sessions with auto-refresh</li>
            </ul>
          </div>
          <p className="auth-left-copy">© 2025 paisekabhoot.com</p>
        </div>

        <div className="auth-right">

          {msg.text && (
            <div className={`auth-msg ${msg.type}`}>{msg.text}</div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} noValidate>
              <h2 className="auth-heading">Welcome back</h2>
              <p className="auth-subhead">Log in to your account</p>

              <button type="button" className="btn-google" onClick={handleGoogle}>
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="divider"><hr /><span>or</span><hr /></div>

              <div className="field">
                <label htmlFor="login-email">Email</label>
                <input id="login-email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="login-pass">Password</label>
                <input id="login-pass" type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" />
              </div>

              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Logging in…' : 'Log in →'}
              </button>

              <p className="switch-text">
                No account?{' '}
                <button type="button" className="link-btn" onClick={() => switchMode('signup')}>Sign up</button>
                {' · '}
                <button type="button" className="link-btn" onClick={() => switchMode('forgot')}>Forgot password?</button>
              </p>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignUp} noValidate>
              <h2 className="auth-heading">Create account</h2>
              <p className="auth-subhead">Join paisekabhoot.com — free forever</p>

              <button type="button" className="btn-google" onClick={handleGoogle}>
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="divider"><hr /><span>or</span><hr /></div>

              <div className="field">
                <label htmlFor="signup-name">Full name</label>
                <input id="signup-name" type="text" value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Rahul Sharma" autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="signup-email">Email</label>
                <input id="signup-email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="signup-pass">Password</label>
                <input id="signup-pass" type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8+ characters" autoComplete="new-password" />
              </div>

              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account →'}
              </button>

              <p className="switch-text">
                Already have an account?{' '}
                <button type="button" className="link-btn" onClick={() => switchMode('login')}>Log in</button>
              </p>
            </form>
          )}

          {mode === 'verify_sent' && (
            <div className="done-screen">
              <div className="done-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    stroke="#3ecf8e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="auth-heading" style={{ textAlign: 'center' }}>Check your email!</h2>
              <p className="auth-subhead" style={{ textAlign: 'center' }}>
                We sent a verification link to<br />
                <strong style={{ color: '#3ecf8e' }}>{email}</strong><br /><br />
                Click the link to verify your account, then come back to log in.
              </p>
              <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => switchMode('login')}>
                Go to login →
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} noValidate>
              <h2 className="auth-heading">Reset password</h2>
              <p className="auth-subhead">Enter your email and we'll send a reset link</p>

              <div className="field">
                <label htmlFor="forgot-email">Email</label>
                <input id="forgot-email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" />
              </div>

              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link →'}
              </button>

              <p className="switch-text">
                <button type="button" className="link-btn" onClick={() => switchMode('login')}>Back to login</button>
              </p>
            </form>
          )}

          {mode === 'reset_sent' && (
            <div className="done-screen">
              <div className="done-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    stroke="#3ecf8e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="auth-heading" style={{ textAlign: 'center' }}>Reset link sent!</h2>
              <p className="auth-subhead" style={{ textAlign: 'center' }}>
                We sent a password reset link to<br />
                <strong style={{ color: '#3ecf8e' }}>{email}</strong><br /><br />
                Click the link in the email to set a new password.
              </p>
              <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => switchMode('login')}>
                Back to login →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
