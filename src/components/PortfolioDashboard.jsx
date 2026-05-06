import { useState, useEffect, useCallback } from 'react'
import { getPortfolio, savePortfolio, addHolding, addTransaction, removeHolding, calcTotalUnits, calcTotalInvested } from '../store/store'
import { searchSchemes, fetchLiveDataSupabase, getLatestNAV } from '../api/mfapi'

export default function PortfolioDashboard() {
  const [portfolio, setPortfolio] = useState([])
  const [liveData, setLiveData] = useState({}) // schemeCode -> { nav, returns, dailyPnL, meta, navHistory }
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(null)

  // Load portfolio
  useEffect(() => {
    setPortfolio(getPortfolio())
  }, [])

  // Fetch live NAV for all holdings
  const fetchLiveData = useCallback(async () => {
    const p = getPortfolio()
    if (p.length === 0) { setLoading(false); return }

    setLoading(true)
    const dataMap = {}
    const codes = [...new Set(p.map(h => h.schemeCode))]

    await Promise.all(codes.map(async (code) => {
      const holding = p.find(h => h.schemeCode === code)
      const units = calcTotalUnits(holding)
      const result = await fetchLiveDataSupabase(code, units)
      
      if (result) {
        dataMap[code] = result
      }
    }))

    setLiveData(dataMap)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLiveData()
  }, [fetchLiveData])

  // Aggregated stats
  const totalInvested = portfolio.reduce((sum, h) => sum + calcTotalInvested(h), 0)
  const totalCurrentValue = portfolio.reduce((sum, h) => {
    const units = calcTotalUnits(h)
    const navData = liveData[h.schemeCode]
    if (!navData) return sum
    return sum + units * navData.nav
  }, 0)
  const totalGain = totalCurrentValue - totalInvested
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0
  const totalDailyPnL = portfolio.reduce((sum, h) => {
    const navData = liveData[h.schemeCode]
    if (!navData || !navData.dailyPnL) return sum
    return sum + navData.dailyPnL.change
  }, 0)

  // Handle add holding
  const handleAddHolding = (holdingData) => {
    const updated = addHolding(holdingData)
    setPortfolio(updated)
    setShowAddModal(false)
    fetchLiveData()
  }

  // Handle add transaction
  const handleAddTransaction = (holdingId, txData) => {
    const updated = addTransaction(holdingId, txData)
    setPortfolio(updated)
    setShowTxModal(null)
    fetchLiveData()
  }

  // Handle delete holding
  const handleDeleteHolding = (holdingId) => {
    if (!confirm('Remove this holding?')) return
    const updated = removeHolding(holdingId)
    setPortfolio(updated)
    fetchLiveData()
  }

  const fmt = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
  }

  const fmtPct = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—'
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
  }

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">Total Invested</div>
          <div className="stat-value">{fmt(totalInvested)}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Current Value</div>
          <div className="stat-value">{loading ? '...' : fmt(totalCurrentValue)}</div>
        </div>
        <div className={`stat-card ${totalGain >= 0 ? 'green' : 'red'}`}>
          <div className="stat-label">Total Gain/Loss</div>
          <div className="stat-value" style={{ color: totalGain >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {loading ? '...' : fmt(totalGain)}
          </div>
          <div className={`stat-change ${totalGain >= 0 ? 'positive' : 'negative'}`}>
            {loading ? '' : fmtPct(totalGainPct)}
          </div>
        </div>
        <div className={`stat-card ${totalDailyPnL >= 0 ? 'green' : 'red'}`}>
          <div className="stat-label">Daily P&L</div>
          <div className="stat-value" style={{ color: totalDailyPnL >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {loading ? '...' : fmt(totalDailyPnL)}
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Holdings</div>
          <div className="stat-value">{portfolio.length}</div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="card section-full">
        <div className="card-header">
          <div>
            <div className="card-title">Portfolio Holdings</div>
            <div className="card-subtitle">Real-time data from your Supabase Database · NAV updated daily after market close</div>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-primary" id="add-holding-btn" onClick={() => setShowAddModal(true)}>
              + Add Holding
            </button>
            <button className="btn btn-secondary" onClick={fetchLiveData} disabled={loading}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {loading && portfolio.length > 0 ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <div className="loading-text">Fetching live NAV data...</div>
          </div>
        ) : portfolio.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <div className="empty-state-title">No Holdings Yet</div>
            <div className="empty-state-text">
              Add your mutual fund holdings with real scheme codes. Live NAV data will be fetched from your Supabase database automatically.
            </div>
            <button className="btn btn-primary mt-16" onClick={() => setShowAddModal(true)}>
              + Add Your First Holding
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Scheme</th>
                  <th>Category</th>
                  <th>Units</th>
                  <th>Invested</th>
                  <th>Current NAV</th>
                  <th>Current Value</th>
                  <th>Gain/Loss</th>
                  <th>1Y</th>
                  <th>3Y</th>
                  <th>5Y</th>
                  <th>Daily</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map(h => {
                  const units = calcTotalUnits(h)
                  const invested = calcTotalInvested(h)
                  const navData = liveData[h.schemeCode]
                  const currentValue = navData ? units * navData.nav : null
                  const gain = currentValue !== null ? currentValue - invested : null
                  const gainPct = invested > 0 && gain !== null ? (gain / invested) * 100 : null

                  return (
                    <tr key={h.id}>
                      <td>
                        <div style={{ maxWidth: 220 }}>
                          <div className="font-medium" style={{ fontSize: 13, whiteSpace: 'normal', lineHeight: 1.4 }}>{h.schemeName}</div>
                          <div className="text-dim" style={{ fontSize: 11 }}>{h.fundHouse}</div>
                        </div>
                      </td>
                      <td><span className="badge badge-primary">{h.category || '—'}</span></td>
                      <td>{units.toFixed(3)}</td>
                      <td>{fmt(invested)}</td>
                      <td>
                        {navData ? (
                          <div>
                            <div>{navData.nav.toFixed(4)}</div>
                            <div className="text-dim" style={{ fontSize: 10 }}>{navData.navDate}</div>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="font-bold">{currentValue !== null ? fmt(currentValue) : '—'}</td>
                      <td>
                        {gain !== null ? (
                          <div>
                            <div className={gain >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>
                              {fmt(gain)}
                            </div>
                            <div className={gain >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: 11 }}>
                              {fmtPct(gainPct)}
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td className={navData?.returns?.return1Y >= 0 ? 'text-success' : 'text-danger'}>
                        {navData?.returns?.return1Y != null ? fmtPct(navData.returns.return1Y) : '—'}
                      </td>
                      <td className={navData?.returns?.return3Y >= 0 ? 'text-success' : 'text-danger'}>
                        {navData?.returns?.return3Y != null ? fmtPct(navData.returns.return3Y) : '—'}
                      </td>
                      <td className={navData?.returns?.return5Y >= 0 ? 'text-success' : 'text-danger'}>
                        {navData?.returns?.return5Y != null ? fmtPct(navData.returns.return5Y) : '—'}
                      </td>
                      <td>
                        {navData?.dailyPnL ? (
                          <span className={navData.dailyPnL.change >= 0 ? 'text-success' : 'text-danger'}>
                            {fmtPct(navData.dailyPnL.changePct)}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <div className="flex gap-8">
                          <button className="btn btn-sm btn-secondary" onClick={() => setShowTxModal(h.id)}>+Tx</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteHolding(h.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Holding Modal */}
      {showAddModal && (
        <AddHoldingModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddHolding}
        />
      )}

      {/* Add Transaction Modal */}
      {showTxModal && (
        <AddTransactionModal
          holdingId={showTxModal}
          onClose={() => setShowTxModal(null)}
          onAdd={handleAddTransaction}
        />
      )}
    </div>
  )
}


// ============================================================
// Add Holding Modal — searches mfapi.in in real time
// ============================================================
function AddHoldingModal({ onClose, onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [searching, setSearching] = useState(false)
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0])
  const [txAmount, setTxAmount] = useState('')
  const [txNav, setTxNav] = useState('')
  const [loadingNav, setLoadingNav] = useState(false)

  // Debounced search
  useEffect(() => {
    if (query.length < 3) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const r = await searchSchemes(query)
      setResults(r)
      setSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  // Auto-fetch latest NAV when scheme selected
  useEffect(() => {
    if (!selected) return
    if (selected.latestNav) {
      setTxNav(selected.latestNav)
    } else {
      (async () => {
        setLoadingNav(true)
        const data = await getLatestNAV(selected.schemeCode)
        if (data && data.nav) {
          setTxNav(data.nav)
        }
        setLoadingNav(false)
      })()
    }
  }, [selected])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selected || !txAmount || !txNav) return
    const amount = parseFloat(txAmount)
    const nav = parseFloat(txNav)
    const units = amount / nav

    onAdd({
      schemeCode: selected.schemeCode,
      schemeName: selected.schemeName,
      fundHouse: selected.schemeName.split(' -')[0] || '',
      category: '',
      transactions: [{
        id: Date.now().toString(36),
        date: txDate,
        amount,
        nav,
        units,
        type: 'BUY',
      }],
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Add Mutual Fund Holding</div>
        <form onSubmit={handleSubmit}>
          {/* Search */}
          <div className="form-group search-dropdown">
            <label className="form-label">Search Scheme (via Supabase)</label>
            <input
              id="scheme-search"
              className="form-input"
              placeholder="Type fund name (e.g., Parag Parikh Flexi)..."
              value={selected ? selected.schemeName : query}
              onChange={e => { setSelected(null); setQuery(e.target.value) }}
              autoFocus
            />
            {searching && <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 4 }}>Searching...</div>}
            {!selected && results.length > 0 && (
              <div className="search-results">
                {results.map(r => (
                  <div
                    key={r.schemeCode}
                    className="search-result-item"
                    onClick={() => { setSelected(r); setResults([]) }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontSize: 13 }}>{r.schemeName}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Code: {r.schemeCode}</div>
                    </div>
                    {r.performance && (
                      <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
                        {r.performance.return1Y && <span className={r.performance.return1Y >= 0 ? 'text-success' : 'text-danger'}>1Y: {r.performance.return1Y}%</span>}
                        {r.performance.return3Y && <span className={r.performance.return3Y >= 0 ? 'text-success' : 'text-danger'}>3Y: {r.performance.return3Y}%</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <>
              <div className="card" style={{ background: 'var(--color-bg-secondary)', padding: '12px', marginBottom: '16px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Performance Metrics (Supabase)</div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>1 Year</div>
                    <div className={selected.performance?.return1Y >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: '600' }}>
                      {selected.performance?.return1Y != null ? `${selected.performance.return1Y}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>3 Year</div>
                    <div className={selected.performance?.return3Y >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: '600' }}>
                      {selected.performance?.return3Y != null ? `${selected.performance.return3Y}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>5 Year</div>
                    <div className={selected.performance?.return5Y >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: '600' }}>
                      {selected.performance?.return5Y != null ? `${selected.performance.return5Y}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>Current NAV</div>
                    <div style={{ fontWeight: '600' }}>₹{selected.latestNav || '—'}</div>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Investment Date</label>
                <input className="form-input" type="date" value={txDate} onChange={e => setTxDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="e.g. 50000"
                  value={txAmount}
                  onChange={e => setTxAmount(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">NAV at purchase {loadingNav ? '(loading...)' : ''}</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.0001"
                  placeholder="NAV"
                  value={txNav}
                  onChange={e => setTxNav(e.target.value)}
                />
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4 }}>
                  Auto-filled with latest NAV. Change to your actual purchase NAV for accuracy.
                </div>
              </div>
              <div className="flex gap-8 mt-16">
                <button type="submit" className="btn btn-primary" id="confirm-add-holding">Add Holding</button>
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}


// ============================================================
// Add Transaction Modal
// ============================================================
function AddTransactionModal({ holdingId, onClose, onAdd }) {
  const [type, setType] = useState('BUY')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [nav, setNav] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    const n = parseFloat(nav)
    if (!amt || !n) return
    onAdd(holdingId, {
      date,
      amount: amt,
      nav: n,
      units: amt / n,
      type,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Add Transaction</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
              <option value="BUY">Buy (Lumpsum)</option>
              <option value="SIP">SIP</option>
              <option value="SELL">Sell / Redeem</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input className="form-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">NAV</label>
            <input className="form-input" type="number" step="0.0001" value={nav} onChange={e => setNav(e.target.value)} />
          </div>
          <div className="flex gap-8 mt-16">
            <button type="submit" className="btn btn-primary">Add Transaction</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
