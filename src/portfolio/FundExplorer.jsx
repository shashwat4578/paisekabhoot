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

  const renderMetric = (abs, ann) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px' }}>
        <span className={abs >= 0 ? 'text-success' : 'text-danger'}>
          {fmtPct(abs)} (Abs)
        </span>
        <span className={ann >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: '600' }}>
          {fmtPct(ann)} (Ann)
        </span>
      </div>
    );
  };

  const [selectedCategory, setSelectedCategory] = useState('All')

  // Group results by category
  const categories = ['All', ...new Set(results.map(f => f.category))].sort()
  
  const groupedResults = results.reduce((acc, fund) => {
    const cat = fund.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(fund)
    return acc
  }, {})

  const displayedCategories = selectedCategory === 'All' 
    ? Object.keys(groupedResults).sort() 
    : [selectedCategory].filter(c => groupedResults[c])

  return (
    <div className="section-full">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Explore Mutual Funds</div>
            <div className="card-subtitle">Search over 10,000+ schemes categorized by Mid Cap, Small Cap, Hybrid, etc.</div>
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

          {results.length > 0 && (
            <div className="flex flex-wrap gap-8 mt-12 mb-12">
              {categories.map(cat => (
                <button 
                  key={cat}
                  className={`badge ${selectedCategory === cat ? 'badge-primary' : 'badge-secondary'}`}
                  style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat} ({cat === 'All' ? results.length : groupedResults[cat]?.length || 0})
                </button>
              ))}
            </div>
          )}

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
            <div className="mt-24">
              {displayedCategories.map(category => (
                <div key={category} className="mb-32">
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '700', 
                    color: 'var(--color-primary)', 
                    marginBottom: '16px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid var(--color-border)'
                  }}>
                    {category}
                  </h3>
                  <div className="table-wrapper">
                    <table style={{ tableLayout: 'auto' }}>
                      <thead>
                        <tr>
                          <th style={{ minWidth: '180px' }}>Scheme Name</th>
                          <th>Latest NAV</th>
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
                        </tr>
                      </thead>
                      <tbody>
                        {groupedResults[category].map(f => (
                          <tr key={f.schemeCode}>
                            <td>
                              <div className="font-bold" style={{ color: 'var(--color-text)', fontSize: '12px' }}>{f.schemeName}</div>
                              <div className="text-dim" style={{ fontSize: '10px' }}>Code: {f.schemeCode}</div>
                            </td>
                            <td className="font-medium">
                              {f.latestNav ? `₹${f.latestNav.toFixed(4)}` : '—'}
                            </td>
                            <td>{renderMetric(f.performance?.return_1d_abs, f.performance?.return_1d_ann)}</td>
                            <td>{renderMetric(f.performance?.return_1w_abs, f.performance?.return_1w_ann)}</td>
                            <td>{renderMetric(f.performance?.return_1m_abs, f.performance?.return_1m_ann)}</td>
                            <td>{renderMetric(f.performance?.return_3m_abs, f.performance?.return_3m_ann)}</td>
                            <td>{renderMetric(f.performance?.return_6m_abs, f.performance?.return_6m_ann)}</td>
                            <td>{renderMetric(f.performance?.return_1y_abs, f.performance?.return_1y_ann)}</td>
                            <td>{renderMetric(f.performance?.return_2y_abs, f.performance?.return_2y_ann)}</td>
                            <td>{renderMetric(f.performance?.return_3y_abs, f.performance?.return_3y_ann)}</td>
                            <td>{renderMetric(f.performance?.return_5y_abs, f.performance?.return_5y_ann)}</td>
                            <td>{renderMetric(f.performance?.return_10y_abs, f.performance?.return_10y_ann)}</td>
                            <td>{renderMetric(f.performance?.return_inception_abs, f.performance?.return_inception_ann)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
