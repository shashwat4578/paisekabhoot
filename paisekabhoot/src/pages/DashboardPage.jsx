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

  const mobileNumber = profile?.mobile
    || user?.user_metadata?.mobile
    || 'Verified via OTP'

  const panCard = profile?.pan
    || user?.user_metadata?.pan
    || 'Verified'

  const taxStatus = profile?.tax_status
    || user?.user_metadata?.tax_status
    || 'Individual'

  const kycStatus = profile?.kyc_status
    || user?.user_metadata?.kyc_status
    || 'VERIFIED'

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
          <h1>Welcome, {displayName}!</h1>
          <p>Your account details & verified profile status from Supabase</p>
        </div>

        <div className="info-grid">
          <div className="info-card">
            <span className="info-label">Full Name</span>
            <span className="info-value" style={{ color: '#ffffff', fontWeight: 600 }}>{displayName}</span>
          </div>

          <div className="info-card">
            <span className="info-label">Email Address</span>
            <span className="info-value">{user?.email}</span>
          </div>

          <div className="info-card">
            <span className="info-label">Mobile Number</span>
            <span className="info-value">{mobileNumber}</span>
          </div>

          <div className="info-card">
            <span className="info-label">PAN Number</span>
            <span className="info-value mono" style={{ letterSpacing: '1px' }}>{panCard}</span>
          </div>

          <div className="info-card">
            <span className="info-label">User KYC Status</span>
            <span className="info-value" style={{ color: '#10b981', fontWeight: 700 }}>
              ✓ {kycStatus} (Individual)
            </span>
          </div>

          <div className="info-card">
            <span className="info-label">Tax Status</span>
            <span className="info-value">{taxStatus}</span>
          </div>

          <div className="info-card">
            <span className="info-label">Member Since</span>
            <span className="info-value">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : new Date(user?.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              }
            </span>
          </div>

          <div className="info-card">
            <span className="info-label">Authentication Method</span>
            <span className="info-value">
              {user?.app_metadata?.provider === 'google' ? 'Google OAuth 2.0' : 'Email & Mobile OTP'}
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
