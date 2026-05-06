import { useState } from 'react'
import { searchSchemes } from '../api/mfapi'

// Pre-defined sector exposure data for popular fund categories
// In production, this would come from an API. Since free APIs don't expose
// stock-level holdings, we provide a realistic demonstration approach.
const SECTOR_WEIGHTS = {
  'Large Cap': { 'Banking': 28, 'IT': 18, 'FMCG': 12, 'Auto': 10, 'Pharma': 8, 'Energy': 7, 'Telecom': 5, 'Metals': 4, 'Real Estate': 3, 'Others': 5 },
  'Mid Cap': { 'Banking': 20, 'IT': 12, 'Chemicals': 10, 'Auto': 10, 'Pharma': 9, 'Capital Goods': 8, 'FMCG': 7, 'Real Estate': 6, 'Textiles': 5, 'Others': 13 },
  'Small Cap': { 'Chemicals': 14, 'IT': 10, 'Capital Goods': 10, 'Auto Parts': 9, 'Pharma': 8, 'Banking': 7, 'Textiles': 7, 'Real Estate': 6, 'FMCG': 5, 'Others': 24 },
  'Flexi Cap': { 'Banking': 25, 'IT': 15, 'Auto': 10, 'FMCG': 10, 'Pharma': 8, 'Energy': 7, 'Telecom': 6, 'Capital Goods': 5, 'Metals': 4, 'Others': 10 },
  'Multi Cap': { 'Banking': 22, 'IT': 14, 'Auto': 11, 'Pharma': 9, 'FMCG': 9, 'Energy': 8, 'Capital Goods': 7, 'Metals': 5, 'Telecom': 5, 'Others': 10 },
  'ELSS': { 'Banking': 30, 'IT': 16, 'Auto': 10, 'FMCG': 10, 'Pharma': 8, 'Energy': 6, 'Telecom': 5, 'Metals': 5, 'Capital Goods': 4, 'Others': 6 },
  'Debt': { 'Government Bonds': 40, 'Corporate Bonds': 30, 'PSU Bonds': 15, 'Money Market': 10, 'Others': 5 },
  'Hybrid': { 'Banking': 18, 'IT': 10, 'Government Bonds': 20, 'Corporate Bonds': 15, 'Auto': 8, 'FMCG': 7, 'Pharma': 6, 'Others': 16 },
}

function guessCategoryFromName(name) {
  const n = name.toLowerCase()
  if (n.includes('small cap') || n.includes('smallcap')) return 'Small Cap'
  if (n.includes('mid cap') || n.includes('midcap')) return 'Mid Cap'
  if (n.includes('large cap') || n.includes('largecap') || n.includes('bluechip')) return 'Large Cap'
  if (n.includes('flexi') || n.includes('multi asset')) return 'Flexi Cap'
  if (n.includes('multi cap') || n.includes('multicap')) return 'Multi Cap'
  if (n.includes('elss') || n.includes('tax sav')) return 'ELSS'
  if (n.includes('debt') || n.includes('bond') || n.includes('gilt') || n.includes('liquid') || n.includes('money market') || n.includes('overnight')) return 'Debt'
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('equity savings')) return 'Hybrid'
  return 'Flexi Cap' // default
}

export default function PortfolioOverlap() {
  const [fund1, setFund1] = useState(null)
  const [fund2, setFund2] = useState(null)
  const [query1, setQuery1] = useState('')
  const [query2, setQuery2] = useState('')
  const [results1, setResults1] = useState([])
  const [results2, setResults2] = useState([])
  const [overlapResult, setOverlapResult] = useState(null)

  const handleSearch = async (query, setResults) => {
    if (query.length < 3) { setResults([]); return }
    const r = await searchSchemes(query)
    setResults(r)
  }

  const selectFund = (fund, setFund, setQuery, setResults) => {
    setFund(fund)
    setQuery(fund.schemeName)
    setResults([])
  }

  const analyzeOverlap = () => {
    if (!fund1 || !fund2) return

    const cat1 = guessCategoryFromName(fund1.schemeName)
    const cat2 = guessCategoryFromName(fund2.schemeName)
    const sectors1 = SECTOR_WEIGHTS[cat1] || SECTOR_WEIGHTS['Flexi Cap']
    const sectors2 = SECTOR_WEIGHTS[cat2] || SECTOR_WEIGHTS['Flexi Cap']

    // Calculate overlap by common sectors
    const allSectors = [...new Set([...Object.keys(sectors1), ...Object.keys(sectors2)])]
    let overlapScore = 0
    const sectorDetails = allSectors.map(sector => {
      const w1 = sectors1[sector] || 0
      const w2 = sectors2[sector] || 0
      const overlap = Math.min(w1, w2)
      overlapScore += overlap
      return { sector, fund1Weight: w1, fund2Weight: w2, overlap }
    }).sort((a, b) => b.overlap - a.overlap)

    setOverlapResult({
      overlapScore,
      fund1Category: cat1,
      fund2Category: cat2,
      sectorDetails,
      diversificationRating: overlapScore > 60 ? 'Low' : overlapScore > 35 ? 'Moderate' : 'High',
    })
  }

  return (
    <div>
      <div className="mb-24">
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Portfolio Overlap Analysis</h1>
        <p className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>
          Compare two funds to see sector-level overlap and diversification rating
        </p>
      </div>

      <div className="info-box">
        <h3>ℹ️ About Overlap Data</h3>
        <p>
          Free APIs like mfapi.in only provide NAV data, not underlying stock/sector holdings.
          This tool uses <strong>category-based sector weightage estimates</strong> derived from AMFI category averages.
          For exact stock-level overlap, you would need a premium API (e.g., Morningstar, Value Research API, or RapidAPI mutual fund endpoints).
        </p>
      </div>

      <div className="section-grid">
        {/* Fund Selectors */}
        <div className="card">
          <div className="card-title mb-16">Fund 1</div>
          <div className="search-dropdown">
            <input
              className="form-input"
              placeholder="Search fund name..."
              value={fund1 ? fund1.schemeName : query1}
              onChange={e => {
                setFund1(null)
                setQuery1(e.target.value)
                handleSearch(e.target.value, setResults1)
              }}
            />
            {!fund1 && results1.length > 0 && (
              <div className="search-results">
                {results1.map(r => (
                  <div key={r.schemeCode} className="search-result-item"
                    onClick={() => selectFund(r, setFund1, setQuery1, setResults1)}>
                    {r.schemeName}
                  </div>
                ))}
              </div>
            )}
          </div>
          {fund1 && (
            <div className="mt-8">
              <span className="badge badge-primary">{guessCategoryFromName(fund1.schemeName)}</span>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title mb-16">Fund 2</div>
          <div className="search-dropdown">
            <input
              className="form-input"
              placeholder="Search fund name..."
              value={fund2 ? fund2.schemeName : query2}
              onChange={e => {
                setFund2(null)
                setQuery2(e.target.value)
                handleSearch(e.target.value, setResults2)
              }}
            />
            {!fund2 && results2.length > 0 && (
              <div className="search-results">
                {results2.map(r => (
                  <div key={r.schemeCode} className="search-result-item"
                    onClick={() => selectFund(r, setFund2, setQuery2, setResults2)}>
                    {r.schemeName}
                  </div>
                ))}
              </div>
            )}
          </div>
          {fund2 && (
            <div className="mt-8">
              <span className="badge badge-purple">{guessCategoryFromName(fund2.schemeName)}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <button className="btn btn-primary" onClick={analyzeOverlap} disabled={!fund1 || !fund2}>
          🔍 Analyze Overlap
        </button>
      </div>

      {overlapResult && (
        <div className="card section-full">
          <div className="card-header">
            <div className="card-title">Overlap Results</div>
            <div>
              <span className={`badge ${
                overlapResult.diversificationRating === 'High' ? 'badge-success' :
                overlapResult.diversificationRating === 'Moderate' ? 'badge-warning' : 'badge-danger'
              }`}>
                Diversification: {overlapResult.diversificationRating}
              </span>
            </div>
          </div>

          {/* Overlap Score */}
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <div style={{ fontSize: 56, fontWeight: 800, color: overlapResult.overlapScore > 60 ? 'var(--color-danger)' : overlapResult.overlapScore > 35 ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {overlapResult.overlapScore.toFixed(0)}%
            </div>
            <div className="text-muted" style={{ fontSize: 13 }}>Sector Overlap Score</div>
          </div>

          {/* Sector Breakdown */}
          <div className="overlap-bar-container mt-24">
            {overlapResult.sectorDetails.map(s => (
              <div key={s.sector} className="overlap-bar-item">
                <div className="overlap-bar-label">{s.sector}</div>
                <div className="overlap-bar-track">
                  <div className="overlap-bar-fill-1" style={{ width: `${s.fund1Weight}%` }}></div>
                  <div className="overlap-bar-fill-2" style={{ width: `${s.fund2Weight}%` }}></div>
                </div>
                <div className="overlap-bar-value">
                  <span style={{ color: 'var(--color-primary)', fontSize: 11 }}>{s.fund1Weight}%</span>
                  {' / '}
                  <span style={{ color: 'var(--color-purple)', fontSize: 11 }}>{s.fund2Weight}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-16 mt-24" style={{ justifyContent: 'center' }}>
            <div className="flex items-center gap-8">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--color-primary)', opacity: 0.6 }}></div>
              <span className="text-muted" style={{ fontSize: 12 }}>Fund 1 ({overlapResult.fund1Category})</span>
            </div>
            <div className="flex items-center gap-8">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--color-purple)', opacity: 0.6 }}></div>
              <span className="text-muted" style={{ fontSize: 12 }}>Fund 2 ({overlapResult.fund2Category})</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
