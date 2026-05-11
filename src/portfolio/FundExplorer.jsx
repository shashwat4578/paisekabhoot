import { useState, useEffect, useMemo } from 'react'
import { searchSchemes, getTopFundsByCategory } from '../api/mfapi'

export default function FundExplorer() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [defaultFunds, setDefaultFunds] = useState([])
  const [searching, setSearching] = useState(false)
  const [isDefaultView, setIsDefaultView] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('All')

  // Initial load: Top performing funds by category
  useEffect(() => {
    const fetchDefault = async () => {
      setSearching(true)
      const top = await getTopFundsByCategory()
      setDefaultFunds(top)
      setResults(top)
      setSearching(false)
    }
    fetchDefault()
  }, [])

  // Debounced search logic
  useEffect(() => {
    if (query.trim().length === 0) {
      setResults(defaultFunds)
      setIsDefaultView(true)
      setSearching(false)
      return
    }

    if (query.trim().length < 2) return

    const timer = setTimeout(async () => {
      setSearching(true)
      setIsDefaultView(false)
      const r = await searchSchemes(query)
      setResults(r)
      setSearching(false)
    }, 150) // Reduced to 150ms for near-instant feel

    return () => clearTimeout(timer)
  }, [query, defaultFunds])

  // Grouping logic (Memoized for zero-lag UI)
  const { groupedResults, categories } = useMemo(() => {
    const groups = results.reduce((acc, fund) => {
      const cat = fund.category || 'Other'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(fund)
      return acc
    }, {})

    const cats = ['All', ...Object.keys(groups)].sort()
    return { groupedResults: groups, categories: cats }
  }, [results])

  const displayedCategories = useMemo(() => {
    if (selectedCategory === 'All') return Object.keys(groupedResults).sort()
    return [selectedCategory].filter(c => groupedResults[c])
  }, [selectedCategory, groupedResults])

  const fmtPct = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—'
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
  }

  const renderMetric = (abs, ann) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', whiteSpace: 'nowrap' }}>
        <span className={abs >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '10px' }}>
          {fmtPct(abs)} <span style={{ opacity: 0.6, fontSize: '8px' }}>Abs</span>
        </span>
        <span className={ann >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: '700' }}>
          {fmtPct(ann)} <span style={{ opacity: 0.6, fontSize: '8px' }}>Ann</span>
        </span>
      </div>
    );
  };

  return (
    <div className="section-full">
      <div className="card">
        <div className="card-header" style={{ paddingBottom: 12 }}>
          <div className="flex items-center justify-between w-full">
            <div>
              <div className="card-title" style={{ fontSize: 20, fontWeight: 800 }}>
                {isDefaultView ? 'Top Performing Funds' : 'Search Results'}
              </div>
              <div className="card-subtitle">
                {isDefaultView 
                  ? 'Top 5 picks from every major category (3Y Returns)' 
                  : `Found ${results.length} matches for "${query}"`}
              </div>
            </div>
            {searching && <div className="spinner-sm"></div>}
          </div>
        </div>
        
        <div style={{ padding: '0 24px 24px 24px' }}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Quick search... (e.g. 'Small Cap', 'Axis', 'Quant')"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ fontSize: '18px', padding: '14px 20px', borderRadius: '12px', border: '2px solid var(--color-border-hover)' }}
            />
          </div>

          {categories.length > 1 && (
            <div className="flex flex-wrap gap-8 mb-20" style={{ padding: '4px 0' }}>
              {categories.map(cat => (
                <button 
                  key={cat}
                  className={`badge ${selectedCategory === cat ? 'badge-primary' : 'badge-secondary'}`}
                  style={{ cursor: 'pointer', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 600, fontSize: 11 }}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat} <span style={{ opacity: 0.7, marginLeft: 4 }}>{cat === 'All' ? results.length : groupedResults[cat]?.length}</span>
                </button>
              ))}
            </div>
          )}

          {!searching && query.length >= 2 && results.length === 0 && (
            <div className="empty-state" style={{ padding: '60px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontWeight: 600, fontSize: 18 }}>No funds found</div>
              <div className="text-dim">Try different keywords or check your spelling.</div>
            </div>
          )}

          {results.length > 0 && (
            <div className="animate-fade-in">
              {displayedCategories.map(category => (
                <div key={category} className="mb-40">
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ height: '24px', width: '4px', background: 'var(--color-primary)', borderRadius: '2px' }}></div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--color-text)' }}>
                      {category} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-dim)', marginLeft: 8 }}>({groupedResults[category].length} Funds)</span>
                    </h3>
                  </div>
                  
                  <div className="table-wrapper" style={{ borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ minWidth: '220px' }}>Scheme Name</th>
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
                            <td style={{ padding: '12px 16px' }}>
                              <div className="font-bold" style={{ color: 'var(--color-text)', fontSize: '13px', lineHeight: 1.4 }}>{f.schemeName}</div>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                                <span style={{ fontSize: '10px', background: 'var(--color-bg-alt)', padding: '2px 6px', borderRadius: '4px', color: 'var(--color-text-dim)' }}>{f.schemeCode}</span>
                                {f.exitLoad && (
                                  <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '700' }}>
                                    Load: {f.exitLoad}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="font-bold" style={{ fontSize: 13 }}>
                              {f.latestNav ? `₹${f.latestNav.toFixed(2)}` : '—'}
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
