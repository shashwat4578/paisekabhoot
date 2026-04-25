import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import {
  signUpWithEmail,
  loginWithEmail,
  loginWithGoogle,
  sendEmailOtp,
  verifyEmailOtp,
  resendOtp,
  sendPasswordReset,
} from '../lib/auth'
import '../styles/auth.css'

// Steps: 'form' → 'otp' → 'done'
// Modes (on form step): 'login' | 'signup' | 'forgot'

export default function LoginPage() {
  const navigate = useNavigate()

  const [step, setStep]         = useState('form')
  const [mode, setMode]         = useState('login')
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState({ text: '', type: '' }) // type: 'err' | 'ok'

  // Form fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')

  // OTP state
  const [otp, setOtp]           = useState(['', '', '', '', '', ''])
  const [otpFlow, setOtpFlow]   = useState('login') // 'login' | 'signup'
  const otpRefs                 = useRef([])

  const showMsg  = (text, type) => setMsg({ text, type })
  const clearMsg = () => setMsg({ text: '', type: '' })
  const switchMode = (m) => { setMode(m); clearMsg() }

  // ── Validate email format ──────────────────────────────────────────
  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  // ── LOGIN ──────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    if (!isValidEmail(email)) { showMsg('Please enter a valid email address.', 'err'); return }
    if (!password)            { showMsg('Please enter your password.', 'err'); return }

    setLoading(true); clearMsg()
    try {
      await loginWithEmail(email, password) // validates credentials
      await sendEmailOtp(email)             // sends 6-digit OTP
      setOtpFlow('login')
      setStep('otp')
    } catch (err) {
      showMsg(err.message || 'Login failed. Check your credentials.', 'err')
    } finally {
      setLoading(false)
    }
  }

  // ── SIGN UP ────────────────────────────────────────────────────────
  async function handleSignUp(e) {
    e.preventDefault()
    if (!fullName.trim())      { showMsg('Please enter your full name.', 'err'); return }
    if (!isValidEmail(email))  { showMsg('Please enter a valid email address.', 'err'); return }
    if (password.length < 8)   { showMsg('Password must be at least 8 characters.', 'err'); return }

    setLoading(true); clearMsg()
    try {
      await signUpWithEmail(fullName.trim(), email, password)
      setOtpFlow('signup')
      setStep('otp')
      showMsg('Account created! Enter the OTP sent to your email.', 'ok')
    } catch (err) {
      showMsg(err.message || 'Sign up failed. Try again.', 'err')
    } finally {
      setLoading(false)
    }
  }

  // ── FORGOT PASSWORD ────────────────────────────────────────────────
  async function handleForgot(e) {
    e.preventDefault()
    if (!isValidEmail(email)) { showMsg('Please enter a valid email address.', 'err'); return }

    setLoading(true); clearMsg()
    try {
      await sendPasswordReset(email)
      showMsg('Password reset link sent! Check your inbox.', 'ok')
    } catch (err) {
      showMsg(err.message || 'Failed to send reset email.', 'err')
    } finally {
      setLoading(false)
    }
  }

  // ── GOOGLE OAUTH ───────────────────────────────────────────────────
  async function handleGoogle() {
    clearMsg()
    try {
      await loginWithGoogle() // browser redirects — nothing after this runs
    } catch (err) {
      showMsg(err.message || 'Google sign-in failed.', 'err')
    }
  }

  // ── OTP INPUT HANDLING ─────────────────────────────────────────────
  function handleOtpInput(index, value) {
    const cleaned = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[index] = cleaned
    setOtp(next)
    if (cleaned && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
    clearMsg()
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = ['', '', '', '', '', '']
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    setOtp(next)
    otpRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  // ── VERIFY OTP ─────────────────────────────────────────────────────
  async function handleVerifyOtp(e) {
    e.preventDefault()
    const token = otp.join('')
    if (token.length < 6) { showMsg('Please enter all 6 digits.', 'err'); return }

    setLoading(true); clearMsg()
    try {
      const type = otpFlow === 'signup' ? 'signup' : 'email'
      await verifyEmailOtp(email, token, type)
      setStep('done')
    } catch (err) {
      showMsg('Invalid or expired OTP. Please try again.', 'err')
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  // ── RESEND OTP ─────────────────────────────────────────────────────
  async function handleResend() {
    clearMsg()
    try {
      await resendOtp(email, otpFlow === 'signup' ? 'signup' : 'email')
      showMsg('New OTP sent to ' + email, 'ok')
    } catch (err) {
      showMsg(err.message || 'Failed to resend OTP.', 'err')
    }
  }

  // ── RENDER ─────────────────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* ── LEFT PANEL ── */}
        <div className="auth-left">
          <Logo size={42} showText={true} />
          <div className="auth-left-features">
            <p className="feature-label">Your account is protected with</p>
            <ul>
              <li><span className="feat-dot" />OTP email verification on every login</li>
              <li><span className="feat-dot" />Google OAuth 2.0 one-click sign-in</li>
              <li><span className="feat-dot" />Supabase Row Level Security (RLS)</li>
              <li><span className="feat-dot" />JWT sessions with auto-refresh</li>
            </ul>
          </div>
          <p className="auth-left-copy">© 2025 paisekabhoot.com</p>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="auth-right">

          {/* Global message bar */}
          {msg.text && (
            <div className={`auth-msg ${msg.type}`}>{msg.text}</div>
          )}

          {/* ════════ STEP: FORM ════════ */}
          {step === 'form' && (
            <>
              {/* LOGIN */}
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
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="login-pass">Password</label>
                    <input
                      id="login-pass"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </div>

                  <button className="btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Sending OTP…' : 'Log in →'}
                  </button>

                  <p className="switch-text">
                    No account?{' '}
                    <button type="button" className="link-btn" onClick={() => switchMode('signup')}>
                      Sign up
                    </button>
                    {' · '}
                    <button type="button" className="link-btn" onClick={() => switchMode('forgot')}>
                      Forgot password?
                    </button>
                  </p>
                </form>
              )}

              {/* SIGN UP */}
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
                    <input
                      id="signup-name"
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Rahul Sharma"
                      autoComplete="name"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="signup-email">Email</label>
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="signup-pass">Password</label>
                    <input
                      id="signup-pass"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="8+ characters"
                      autoComplete="new-password"
                    />
                  </div>

                  <button className="btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Creating account…' : 'Create account →'}
                  </button>

                  <p className="switch-text">
                    Already have an account?{' '}
                    <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                      Log in
                    </button>
                  </p>
                </form>
              )}

              {/* FORGOT PASSWORD */}
              {mode === 'forgot' && (
                <form onSubmit={handleForgot} noValidate>
                  <h2 className="auth-heading">Reset password</h2>
                  <p className="auth-subhead">
                    Enter your email and we'll send a reset link
                  </p>

                  <div className="field">
                    <label htmlFor="forgot-email">Email</label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>

                  <button className="btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Sending…' : 'Send reset link →'}
                  </button>

                  <p className="switch-text">
                    <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                      Back to login
                    </button>
                  </p>
                </form>
              )}
            </>
          )}

          {/* ════════ STEP: OTP ════════ */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} noValidate>
              <div className="progress-bar">
                <div className="pb-dot done" />
                <div className="pb-dot done" />
                <div className="pb-dot" />
              </div>

              <h2 className="auth-heading">Verify your email</h2>
              <p className="auth-subhead">Enter the 6-digit code sent to</p>
              <div className="email-badge">{email}</div>

              <div className="otp-row" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpInput(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className="otp-digit"
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & continue →'}
              </button>

              <p className="switch-text">
                Didn't get it?{' '}
                <button type="button" className="link-btn" onClick={handleResend}>
                  Resend code
                </button>
                {' · '}
                <button type="button" className="link-btn" onClick={() => { setStep('form'); clearMsg() }}>
                  Change email
                </button>
              </p>
            </form>
          )}

          {/* ════════ STEP: DONE ════════ */}
          {step === 'done' && (
            <div className="done-screen">
              <div className="progress-bar">
                <div className="pb-dot done" />
                <div className="pb-dot done" />
                <div className="pb-dot done" />
              </div>
              <div className="done-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#3ecf8e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="auth-heading" style={{ textAlign: 'center' }}>You're in!</h2>
              <p className="auth-subhead" style={{ textAlign: 'center' }}>
                {otpFlow === 'signup'
                  ? 'Account verified. Welcome to paisekabhoot.com!'
                  : 'Email verified. You are now securely logged in.'}
              </p>
              <button
                className="btn-primary"
                style={{ marginTop: '1.5rem' }}
                onClick={() => navigate('/dashboard')}
              >
                Go to dashboard →
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
