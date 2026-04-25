import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { updatePassword } from '../lib/auth'
import Logo from '../components/Logo'
import '../styles/auth.css'

// Route: /auth/update-password
// User lands here after clicking the password reset link in their email.
// Supabase automatically restores the session from the URL hash.
export default function UpdatePasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [msg, setMsg]             = useState({ text: '', type: '' })

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) {
      setMsg({ text: 'Password must be at least 8 characters.', type: 'err' }); return
    }
    if (password !== confirm) {
      setMsg({ text: 'Passwords do not match.', type: 'err' }); return
    }

    setLoading(true)
    try {
      await updatePassword(password)
      setMsg({ text: 'Password updated! Redirecting…', type: 'ok' })
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
    } catch (err) {
      setMsg({ text: err.message || 'Failed to update password.', type: 'err' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <div className="auth-right" style={{ padding: '2.5rem 2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Logo size={36} showText={true} />
          </div>
          <h2 className="auth-heading">Set new password</h2>
          <p className="auth-subhead">Choose a strong password for your account</p>

          {msg.text && <div className={`auth-msg ${msg.type}`}>{msg.text}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="new-pass">New password</label>
              <input
                id="new-pass"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="8+ characters"
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-pass">Confirm password</label>
              <input
                id="confirm-pass"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Update password →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
