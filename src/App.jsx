import { useState, useEffect } from 'react'
import { supabase } from './api/supabaseClient'
import PortfolioDashboard from './portfolio/PortfolioDashboard'
import GoalTagging from './portfolio/GoalTagging'
import XIRRCalculator from './portfolio/XIRRCalculator'
import PortfolioOverlap from './portfolio/PortfolioOverlap'
import TaxSummary from './portfolio/TaxSummary'
import DataFetchGuide from './components/DataFetchGuide'
import Auth from './login/Auth'
import FundExplorer from './portfolio/FundExplorer'

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'explore', label: '🔍 Explore Funds' },
  { id: 'goals', label: '🎯 Goal Tagging' },
  { id: 'xirr', label: '📈 XIRR' },
  { id: 'overlap', label: '🔍 Overlap' },
  { id: 'tax', label: '🧾 Tax Summary' },
  { id: 'guide', label: '📥 Data Guide' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <PortfolioDashboard />
      case 'explore': return <FundExplorer />
      case 'goals': return <GoalTagging />
      case 'xirr': return <XIRRCalculator />
      case 'overlap': return <PortfolioOverlap />
      case 'tax': return <TaxSummary />
      case 'guide': return <DataFetchGuide />
      default: return <PortfolioDashboard />
    }
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">₹</div>
          <span className="app-logo-text">PaisekaBhoot</span>
        </div>
        <nav className="app-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              id={`nav-${tab.id}`}
              className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="user-profile">
          <span style={{ fontSize: '12px', marginRight: '12px' }} className="text-dim">{session.user.email}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <main className="app-main">
        {renderTab()}
      </main>
    </div>
  )
}
