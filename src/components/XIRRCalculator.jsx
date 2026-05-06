import { useState, useEffect } from 'react'
import { getPortfolio, calcTotalUnits, calcTotalInvested } from '../store/store'
import { calculateXIRR, getLatestNAV } from '../api/mfapi'

export default function XIRRCalculator() {
  const [portfolio, setPortfolio] = useState([])
  const [selectedHolding, setSelectedHolding] = useState('')
  const [xirr, setXirr] = useState(null)
  const [cashFlows, setCashFlows] = useState([])
  const [liveNav, setLiveNav] = useState(null)
  const [loading, setLoading] = useState(false)

  // Manual mode
  const [manualFlows, setManualFlows] = useState([
    { date: '', amount: '' },
    { date: new Date().toISOString().split('T')[0], amount: '' },
  ])
  const [manualXirr, setManualXirr] = useState(null)
  const [mode, setMode] = useState('portfolio') // 'portfolio' | 'manual'

  useEffect(() => {
    setPortfolio(getPortfolio())
  }, [])

  const calculateFromHolding = async (holdingId) => {
    setSelectedHolding(holdingId)
    setXirr(null)
    setCashFlows([])
    setLiveNav(null)

    const holding = portfolio.find(h => h.id === holdingId)
    if (!holding || holding.transactions.length === 0) return

    setLoading(true)

    // Fetch current NAV
    try {
      const data = await getLatestNAV(holding.schemeCode)
      if (data && data.nav) {
        const currentNav = data.nav
        setLiveNav(currentNav)

        const units = calcTotalUnits(holding)
        const currentValue = units * currentNav

        // Build cash flows
        const flows = holding.transactions.map(t => ({
          date: new Date(t.date),
          amount: t.type === 'SELL' ? t.amount : -t.amount,
          label: `${t.type} — ₹${t.amount.toLocaleString('en-IN')}`,
        }))

        // Add current value as final positive flow
        flows.push({
          date: new Date(),
          amount: currentValue,
          label: `Current Value — ₹${currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
        })

        setCashFlows(flows)

        // Calculate XIRR
        const result = calculateXIRR(flows)
        setXirr(result)
      }
    } catch (e) {
      console.error('XIRR calc error:', e)
    }
    setLoading(false)
  }

  const calculateManualXirr = () => {
    const flows = manualFlows
      .filter(f => f.date && f.amount)
      .map(f => ({
        date: new Date(f.date),
        amount: parseFloat(f.amount),
      }))
    if (flows.length < 2) return
    const result = calculateXIRR(flows)
    setManualXirr(result)
  }

  const addManualFlow = () => {
    setManualFlows([...manualFlows, { date: '', amount: '' }])
  }

  const updateManualFlow = (idx, field, value) => {
    const updated = [...manualFlows]
    updated[idx][field] = value
    setManualFlows(updated)
  }

  const removeManualFlow = (idx) => {
    if (manualFlows.length <= 2) return
    setManualFlows(manualFlows.filter((_, i) => i !== idx))
  }

  const fmtPct = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—'
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-24">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>XIRR Calculator</h1>
          <p className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>
            Calculate the true annualized rate of return using the XIRR method (Newton-Raphson)
          </p>
        </div>
        <div className="flex gap-8">
          <button
            className={`btn ${mode === 'portfolio' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('portfolio')}
          >
            From Portfolio
          </button>
          <button
            className={`btn ${mode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('manual')}
          >
            Manual Entry
          </button>
        </div>
      </div>

      {mode === 'portfolio' ? (
        <div className="section-grid">
          {/* Selector */}
          <div className="card">
            <div className="card-title mb-16">Select Holding</div>
            {portfolio.length === 0 ? (
              <div className="text-muted" style={{ fontSize: 13 }}>
                No holdings in your portfolio. Add holdings in the Dashboard tab first.
              </div>
            ) : (
              <div className="flex-col gap-8">
                {portfolio.map(h => (
                  <button
                    key={h.id}
                    className={`btn w-full ${selectedHolding === h.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                    onClick={() => calculateFromHolding(h.id)}
                  >
                    <span style={{ fontSize: 12, lineHeight: 1.4 }}>{h.schemeName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Result */}
          <div className="card">
            <div className="card-title mb-16">XIRR Result</div>
            {loading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <div className="loading-text">Calculating with live NAV...</div>
              </div>
            ) : xirr !== null ? (
              <div>
                <div style={{
                  fontSize: 48,
                  fontWeight: 800,
                  textAlign: 'center',
                  padding: '24px 0',
                  color: xirr >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                }}>
                  {fmtPct(xirr)}
                </div>
                <div className="text-muted" style={{ textAlign: 'center', fontSize: 13, marginBottom: 24 }}>
                  Annualized return (XIRR) using real-time NAV
                </div>

                {/* Cash Flows */}
                <div className="form-label">Cash Flows Used</div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashFlows.map((cf, i) => (
                        <tr key={i}>
                          <td>{cf.date.toLocaleDateString('en-IN')}</td>
                          <td>{cf.label}</td>
                          <td className={cf.amount >= 0 ? 'text-success' : 'text-danger'}>
                            {cf.amount >= 0 ? '+' : ''}₹{Math.abs(cf.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📈</div>
                <div className="empty-state-title">Select a Holding</div>
                <div className="empty-state-text">Choose a holding from the left to calculate its XIRR using live NAV data.</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Manual Mode */
        <div className="section-grid">
          <div className="card">
            <div className="card-title mb-16">Enter Cash Flows</div>
            <p className="text-muted mb-16" style={{ fontSize: 12 }}>
              Use negative amounts for investments and positive for redemptions/current value.
            </p>
            {manualFlows.map((flow, idx) => (
              <div key={idx} className="flex gap-8 items-center mb-8">
                <input
                  className="form-input"
                  type="date"
                  value={flow.date}
                  onChange={e => updateManualFlow(idx, 'date', e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  className="form-input"
                  type="number"
                  placeholder={idx === manualFlows.length - 1 ? 'Current value (+)' : 'Amount (-)'}
                  value={flow.amount}
                  onChange={e => updateManualFlow(idx, 'amount', e.target.value)}
                  style={{ flex: 1 }}
                />
                {manualFlows.length > 2 && (
                  <button className="btn btn-sm btn-danger" onClick={() => removeManualFlow(idx)}>✕</button>
                )}
              </div>
            ))}
            <div className="flex gap-8 mt-16">
              <button className="btn btn-secondary btn-sm" onClick={addManualFlow}>+ Add Row</button>
              <button className="btn btn-primary" onClick={calculateManualXirr}>Calculate XIRR</button>
            </div>
          </div>

          <div className="card">
            <div className="card-title mb-16">Result</div>
            {manualXirr !== null ? (
              <div style={{
                fontSize: 48,
                fontWeight: 800,
                textAlign: 'center',
                padding: '40px 0',
                color: manualXirr >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {fmtPct(manualXirr)}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🧮</div>
                <div className="empty-state-title">Enter Flows & Calculate</div>
                <div className="empty-state-text">Enter your cash flows on the left and click Calculate.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
