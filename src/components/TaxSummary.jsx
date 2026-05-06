import { useState, useEffect } from 'react'
import { getPortfolio, calcTotalUnits, calcTotalInvested } from '../store/store'
import { getLatestNAV } from '../api/mfapi'

export default function TaxSummary() {
  const [portfolio, setPortfolio] = useState([])
  const [liveNavs, setLiveNavs] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState('2025-26')

  useEffect(() => {
    const p = getPortfolio()
    setPortfolio(p)

    // Fetch live NAVs
    const fetchNavs = async () => {
      const codes = [...new Set(p.map(h => h.schemeCode))]
      const navs = {}
      await Promise.all(codes.map(async (code) => {
        try {
          const data = await getLatestNAV(code)
          if (data && data.nav) {
            navs[code] = data.nav
          }
        } catch (e) {
          console.error(e)
        }
      }))
      setLiveNavs(navs)
      setLoading(false)
    }
    fetchNavs()
  }, [])

  const fmt = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
  }

  // Calculate tax for each holding using FIFO
  const taxData = portfolio.map(h => {
    const currentNav = liveNavs[h.schemeCode]
    if (!currentNav) return null

    const buyTransactions = h.transactions
      .filter(t => t.type === 'BUY' || t.type === 'SIP')
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    const units = calcTotalUnits(h)
    const invested = calcTotalInvested(h)
    const currentValue = units * currentNav
    const totalGain = currentValue - invested

    // Determine STCG vs LTCG using FIFO
    let stcgUnits = 0
    let ltcgUnits = 0
    let stcgAmount = 0
    let ltcgAmount = 0
    const now = new Date()
    const oneYear = 365 * 24 * 60 * 60 * 1000

    // For equity funds: LTCG if held > 1 year
    // For debt funds (after Apr 2023): all gains taxed at slab
    const isEquity = !h.schemeName?.toLowerCase().includes('debt') &&
                     !h.schemeName?.toLowerCase().includes('liquid') &&
                     !h.schemeName?.toLowerCase().includes('overnight') &&
                     !h.schemeName?.toLowerCase().includes('gilt') &&
                     !h.schemeName?.toLowerCase().includes('bond')

    for (const tx of buyTransactions) {
      const holdingPeriod = now - new Date(tx.date)
      const txUnits = tx.units || 0
      const gainPerUnit = currentNav - tx.nav
      const gain = gainPerUnit * txUnits

      if (isEquity) {
        if (holdingPeriod > oneYear) {
          ltcgUnits += txUnits
          ltcgAmount += gain
        } else {
          stcgUnits += txUnits
          stcgAmount += gain
        }
      } else {
        // Debt — all gains at slab rate (post Apr 2023 rules)
        stcgUnits += txUnits
        stcgAmount += gain
      }
    }

    // Tax calculations (FY 2025-26 rates)
    // Equity LTCG: 12.5% above ₹1.25L exemption
    // Equity STCG: 20%
    // Debt: At slab rate (assume 30%)
    let estimatedTax = 0
    if (isEquity) {
      const ltcgTaxable = Math.max(ltcgAmount - 125000, 0)
      estimatedTax += ltcgTaxable * 0.125 + stcgAmount * 0.20
    } else {
      estimatedTax += (stcgAmount + ltcgAmount) * 0.30
    }

    return {
      id: h.id,
      schemeName: h.schemeName,
      schemeCode: h.schemeCode,
      isEquity,
      units,
      invested,
      currentValue,
      totalGain,
      stcgAmount: Math.max(stcgAmount, 0),
      ltcgAmount: Math.max(ltcgAmount, 0),
      stcgUnits,
      ltcgUnits,
      estimatedTax: Math.max(estimatedTax, 0),
    }
  }).filter(Boolean)

  const totalSTCG = taxData.reduce((sum, t) => sum + t.stcgAmount, 0)
  const totalLTCG = taxData.reduce((sum, t) => sum + t.ltcgAmount, 0)
  const totalEstTax = taxData.reduce((sum, t) => sum + t.estimatedTax, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-24">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Tax Summary</h1>
          <p className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>
            Capital gains breakdown using FIFO method · FY {selectedYear} rates
          </p>
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
          <option value="2025-26">FY 2025-26</option>
          <option value="2024-25">FY 2024-25</option>
        </select>
      </div>

      {/* Tax Rate Info */}
      <div className="info-box">
        <h3>📋 FY 2025-26 Tax Rates (Budget 2024)</h3>
        <ul>
          <li><strong>Equity LTCG</strong> (held &gt; 1 year): 12.5% above ₹1.25L exemption</li>
          <li><strong>Equity STCG</strong> (held ≤ 1 year): 20%</li>
          <li><strong>Debt Funds</strong> (purchased after Apr 2023): Taxed at income tax slab rate (no indexation)</li>
        </ul>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid mb-24">
        <div className="stat-card green">
          <div className="stat-label">Long-Term Gains</div>
          <div className="stat-value text-success">{loading ? '...' : fmt(totalLTCG)}</div>
          <div className="stat-change positive">LTCG @ 12.5% (above ₹1.25L)</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Short-Term Gains</div>
          <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{loading ? '...' : fmt(totalSTCG)}</div>
          <div className="stat-change" style={{ color: 'var(--color-warning)' }}>STCG @ 20%</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Estimated Tax</div>
          <div className="stat-value text-danger">{loading ? '...' : fmt(totalEstTax)}</div>
          <div className="stat-change negative">If redeemed today</div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="card section-full">
        <div className="card-header">
          <div className="card-title">Holding-wise Capital Gains</div>
          <div className="card-subtitle">Based on FIFO (First-In, First-Out) and current NAV</div>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <div className="loading-text">Fetching live NAV for tax calculation...</div>
          </div>
        ) : taxData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧾</div>
            <div className="empty-state-title">No Holdings to Analyze</div>
            <div className="empty-state-text">Add holdings in the Dashboard tab to see capital gains breakdown.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Scheme</th>
                  <th>Type</th>
                  <th>Invested</th>
                  <th>Current Value</th>
                  <th>Total Gain</th>
                  <th>STCG</th>
                  <th>LTCG</th>
                  <th>Est. Tax</th>
                </tr>
              </thead>
              <tbody>
                {taxData.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ maxWidth: 250, whiteSpace: 'normal', lineHeight: 1.4, fontSize: 13 }}>
                        {t.schemeName}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${t.isEquity ? 'badge-primary' : 'badge-warning'}`}>
                        {t.isEquity ? 'Equity' : 'Debt'}
                      </span>
                    </td>
                    <td>{fmt(t.invested)}</td>
                    <td className="font-bold">{fmt(t.currentValue)}</td>
                    <td className={t.totalGain >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>
                      {fmt(t.totalGain)}
                    </td>
                    <td style={{ color: 'var(--color-warning)' }}>{fmt(t.stcgAmount)}</td>
                    <td className="text-success">{fmt(t.ltcgAmount)}</td>
                    <td className="text-danger font-bold">{fmt(t.estimatedTax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
