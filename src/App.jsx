import { useState } from 'react'
import PortfolioDashboard from './components/PortfolioDashboard'
import GoalTagging from './components/GoalTagging'
import XIRRCalculator from './components/XIRRCalculator'
import PortfolioOverlap from './components/PortfolioOverlap'
import TaxSummary from './components/TaxSummary'
import DataFetchGuide from './components/DataFetchGuide'

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'goals', label: '🎯 Goal Tagging' },
  { id: 'xirr', label: '📈 XIRR' },
  { id: 'overlap', label: '🔍 Overlap' },
  { id: 'tax', label: '🧾 Tax Summary' },
  { id: 'guide', label: '📥 Data Guide' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <PortfolioDashboard />
      case 'goals': return <GoalTagging />
      case 'xirr': return <XIRRCalculator />
      case 'overlap': return <PortfolioOverlap />
      case 'tax': return <TaxSummary />
      case 'guide': return <DataFetchGuide />
      default: return <PortfolioDashboard />
    }
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
      </header>
      <main className="app-main">
        {renderTab()}
      </main>
    </div>
  )
}
