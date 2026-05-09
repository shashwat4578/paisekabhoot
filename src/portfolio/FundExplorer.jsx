import { useState, useEffect } from 'react'
import { searchSchemes } from '../api/mfapi'

export default function FundExplorer() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

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

  const fmtPct = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—'
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
  }

  return (
    <div className="section-full">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Explore Mutual Funds</div>
            <div className="card-subtitle">Search over 10,000+ schemes and check their live performance from Supabase</div>
          </div>
        </div>
        
        <div style={{ padding: '0 24px 24px 24px' }}>
          <div className="form-group">
            <input
              type="text"
              className="form-input"
              placeholder="Search by fund name (e.g. Axis Bluechip, Quant Small Cap)..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ fontSize: '16px', padding: '12px 16px' }}
            />
          </div>

          {searching && (
            <div className="flex items-center gap-8 text-dim" style={{ marginTop: 12 }}>
              <div className="spinner-sm"></div>
              <span>Searching our database...</span>
            </div>
          )}

          {!searching && query.length >= 3 && results.length === 0 && (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div>No funds found matching "{query}"</div>
            </div>
          )}

          {results.length > 0 && (
            <div className="table-wrapper mt-24">
              <table>
                <thead>
                  <tr>
                    <th>Scheme Name</th>
                    <th>Latest NAV</th>
                    <th>1W</th>
                    <th>1M</th>
                    <th>3M</th>
                    <th>6M</th>
                    <th>1Y</th>
                    <th>3Y</th>
                    <th>5Y</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(f => (
                    <tr key={f.schemeCode}>
                      <td>
                        <div className="font-bold" style={{ color: 'var(--color-primary)' }}>{f.schemeName}</div>
                        <div className="text-dim" style={{ fontSize: '11px' }}>Code: {f.schemeCode}</div>
                      </td>
                      <td className="font-medium">
                        {f.latestNav ? `₹${f.latestNav.toFixed(4)}` : '—'}
                      </td>
                      <td className={f.performance?.return1W >= 0 ? 'text-success' : 'text-danger'}>
                        {fmtPct(f.performance?.return1W)}
                      </td>
                      <td className={f.performance?.return1M >= 0 ? 'text-success' : 'text-danger'}>
                        {fmtPct(f.performance?.return1M)}
                      </td>
                      <td className={f.performance?.return3M >= 0 ? 'text-success' : 'text-danger'}>
                        {fmtPct(f.performance?.return3M)}
                      </td>
                      <td className={f.performance?.return6M >= 0 ? 'text-success' : 'text-danger'}>
                        {fmtPct(f.performance?.return6M)}
                      </td>
                      <td className={f.performance?.return1Y >= 0 ? 'text-success' : 'text-danger'}>
                        {fmtPct(f.performance?.return1Y)}
                      </td>
                      <td className={f.performance?.return3Y >= 0 ? 'text-success' : 'text-danger'}>
                        {fmtPct(f.performance?.return3Y)}
                      </td>
                      <td className={f.performance?.return5Y >= 0 ? 'text-success' : 'text-danger'}>
                        {fmtPct(f.performance?.return5Y)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
