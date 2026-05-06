import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuthContext'
import { signOut } from '../lib/auth'
import Logo from '../components/Logo'
import '../styles/dashboard.css'

// Route: /dashboard  (protected — requires auth)
export default function DashboardPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const displayName = profile?.full_name
    || user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'User'

  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <Logo size={32} showText={true} />
        <div className="header-right">
          <div className="avatar">{initials}</div>
          <button className="btn-signout" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="welcome-card">
          <h1>Welcome back, {displayName.split(' ')[0]}!</h1>
          <p>You are securely logged in to paisekabhoot.com</p>
        </div>

        <div className="info-grid">
          <div className="info-card">
            <span className="info-label">Email</span>
            <span className="info-value">{user?.email}</span>
          </div>
          <div className="info-card">
            <span className="info-label">User ID</span>
            <span className="info-value mono">{user?.id?.slice(0, 18)}…</span>
          </div>
          <div className="info-card">
            <span className="info-label">Member since</span>
            <span className="info-value">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : new Date(user?.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              }
            </span>
          </div>
          <div className="info-card">
            <span className="info-label">Auth provider</span>
            <span className="info-value">
              {user?.app_metadata?.provider === 'google' ? 'Google OAuth' : 'Email + OTP'}
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
