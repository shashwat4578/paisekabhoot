import { useState, useEffect, useCallback } from 'react'
import { getPortfolio, savePortfolio, addHolding, addTransaction, removeHolding, calcTotalUnits, calcTotalInvested } from '../store/store'
import { searchSchemes, fetchLiveDataSupabase, getLatestNAV } from '../api/mfapi'
import { fetchUserPortfolio, saveUserPortfolio } from '../api/userApi'

export default function PortfolioDashboard() {
  const [portfolio, setPortfolio] = useState([])
  const [liveData, setLiveData] = useState({}) // schemeCode -> { nav, returns, dailyPnL, meta, navHistory }
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(null)

  // Load portfolio
  useEffect(() => {
    (async () => {
      const cloudPortfolio = await fetchUserPortfolio()
      if (cloudPortfolio && cloudPortfolio.length > 0) {
        setPortfolio(cloudPortfolio)
        savePortfolio(cloudPortfolio) // Also update local cache
      } else {
        setPortfolio(getPortfolio())
      }
    })()
  }, [])

  // Fetch live NAV for all holdings
  const fetchLiveData = useCallback(async () => {
    const p = portfolio.length > 0 ? portfolio : getPortfolio()
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
  }, [portfolio])

  useEffect(() => {
    fetchLiveData()
  }, [fetchLiveData])

  // Handle add holding
  const handleAddHolding = async (holdingData) => {
    const updated = addHolding(holdingData)
    setPortfolio(updated)
    await saveUserPortfolio(updated) // Sync to Cloud
    setShowAddModal(false)
    fetchLiveData()
  }

  // Handle add transaction
  const handleAddTransaction = async (holdingId, txData) => {
    const updated = addTransaction(holdingId, txData)
    setPortfolio(updated)
    await saveUserPortfolio(updated) // Sync to Cloud
    setShowTxModal(null)
    fetchLiveData()
  }

  // Handle delete holding
  const handleDeleteHolding = async (holdingId) => {
    if (!confirm('Remove this holding?')) return
    const updated = removeHolding(holdingId)
    setPortfolio(updated)
    await saveUserPortfolio(updated) // Sync to Cloud
    fetchLiveData()
  }

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
                      <th>Daily</th>
                      <th>1D</th>
                      <th>1W</th>
                      <th>1M</th>
                      <th>3M</th>
                      <th>6M</th>
                      <th>1Y</th>
                      <th>2Y</th>
                      <th>3Y</th>
                      <th>5Y</th>
                      <th>10Y</th>
                      <th>Inception</th>
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

                      const renderMetric = (abs, ann) => {
                        if (abs == null && ann == null) return '—';
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '10px', lineHeight: '1.2' }}>
                            <div className={abs >= 0 ? 'text-success' : 'text-danger'}>{fmtPct(abs)} <span style={{ fontSize: '8px', opacity: 0.7 }}>Abs</span></div>
                            <div className={ann >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>{fmtPct(ann)} <span style={{ fontSize: '8px', opacity: 0.7 }}>Ann</span></div>
                          </div>
                        );
                      };

                      return (
                        <tr key={h.id}>
                          <td>
                            <div style={{ maxWidth: 220 }}>
                              <div className="font-medium" style={{ fontSize: 13, whiteSpace: 'normal', lineHeight: 1.4 }}>{h.schemeName}</div>
                              <div className="text-dim" style={{ fontSize: 11, marginBottom: 4 }}>{h.fundHouse}</div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <span className="badge badge-primary" style={{ fontSize: '9px', padding: '2px 6px' }}>{navData?.category || h.category || '—'}</span>
                                {navData?.exitLoad && (
                                  <span style={{ fontSize: '9px', color: 'var(--color-warning)', fontWeight: '600', background: 'rgba(255, 193, 7, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                    Load: {navData.exitLoad}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
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
                          <td>
                            {navData?.dailyPnL ? (
                              <span className={navData.dailyPnL.change >= 0 ? 'text-success' : 'text-danger'}>
                                {fmtPct(navData.dailyPnL.changePct)}
                              </span>
                            ) : '—'}
                          </td>
                          <td>{renderMetric(navData?.returns?.return_1d_abs, navData?.returns?.return_1d_ann)}</td>
                          <td>{renderMetric(navData?.returns?.return_1w_abs, navData?.returns?.return_1w_ann)}</td>
                          <td>{renderMetric(navData?.returns?.return_1m_abs, navData?.returns?.return_1m_ann)}</td>
                          <td>{renderMetric(navData?.returns?.return_3m_abs, navData?.returns?.return_3m_ann)}</td>
                          <td>{renderMetric(navData?.returns?.return_6m_abs, navData?.returns?.return_6m_ann)}</td>
                          <td>{renderMetric(navData?.returns?.return_1y_abs, navData?.returns?.return_1y_ann)}</td>
                          <td>{renderMetric(navData?.returns?.return_2y_abs, navData?.returns?.return_2y_ann)}</td>
                          <td>{renderMetric(navData?.returns?.return_3y_abs, navData?.returns?.return_3y_ann)}</td>
                          <td>{renderMetric(navData?.returns?.return_5y_abs, navData?.returns?.return_5y_ann)}</td>
                          <td>{renderMetric(navData?.returns?.return_10y_abs, navData?.returns?.return_10y_ann)}</td>
                          <td>{renderMetric(navData?.returns?.return_inception_abs, navData?.returns?.return_inception_ann)}</td>
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
                <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>Performance Metrics (Absolute / Annualized)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>1 Year</div>
                    <div style={{ fontSize: '11px' }}>
                      <span className={selected.performance?.return_1y_abs >= 0 ? 'text-success' : 'text-danger'}>{fmtPct(selected.performance?.return_1y_abs)}</span> / <span className={selected.performance?.return_1y_ann >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: '600' }}>{fmtPct(selected.performance?.return_1y_ann)}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>3 Year</div>
                    <div style={{ fontSize: '11px' }}>
                      <span className={selected.performance?.return_3y_abs >= 0 ? 'text-success' : 'text-danger'}>{fmtPct(selected.performance?.return_3y_abs)}</span> / <span className={selected.performance?.return_3y_ann >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: '600' }}>{fmtPct(selected.performance?.return_3y_ann)}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>5 Year</div>
                    <div style={{ fontSize: '11px' }}>
                      <span className={selected.performance?.return_5y_abs >= 0 ? 'text-success' : 'text-danger'}>{fmtPct(selected.performance?.return_5y_abs)}</span> / <span className={selected.performance?.return_5y_ann >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: '600' }}>{fmtPct(selected.performance?.return_5y_ann)}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>Inception</div>
                    <div style={{ fontSize: '11px' }}>
                      <span className={selected.performance?.return_inception_abs >= 0 ? 'text-success' : 'text-danger'}>{fmtPct(selected.performance?.return_inception_abs)}</span> / <span className={selected.performance?.return_inception_ann >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: '600' }}>{fmtPct(selected.performance?.return_inception_ann)}</span>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                   <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>Current NAV: <span style={{ color: 'var(--color-text)', fontWeight: '600' }}>₹{selected.latestNav || '—'}</span></span>
                   <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>Category: <span style={{ color: 'var(--color-text)', fontWeight: '600' }}>{selected.category || '—'}</span></span>
                   {selected.exitLoad && (
                     <span style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: '600' }}>Exit Load: {selected.exitLoad}</span>
                   )}
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
