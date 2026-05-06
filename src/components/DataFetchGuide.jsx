export default function DataFetchGuide() {
  return (
    <div>
      <div className="mb-24">
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>📥 Data Fetching Guide</h1>
        <p className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>
          How to get your real mutual fund portfolio data and automate daily updates
        </p>
      </div>

      {/* AMFI vs mfapi.in */}
      <div className="card section-full">
        <div className="card-title mb-16">🔄 NAV Data Sources: AMFI vs mfapi.in</div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>AMFI (amfiindia.com)</th>
                <th>mfapi.in ✅ (This app uses)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Source</strong></td>
                <td>Official industry body</td>
                <td>Free wrapper API over AMFI data</td>
              </tr>
              <tr>
                <td><strong>Format</strong></td>
                <td>Raw text/CSV files</td>
                <td>Clean JSON REST API</td>
              </tr>
              <tr>
                <td><strong>Usage</strong></td>
                <td>Requires parsing & database storage</td>
                <td>Direct fetch, no parsing needed</td>
              </tr>
              <tr>
                <td><strong>Reliability</strong></td>
                <td>Primary source, most reliable</td>
                <td>Reliable for developer projects</td>
              </tr>
              <tr>
                <td><strong>Update</strong></td>
                <td>Daily after market close (~9-11 PM)</td>
                <td>Multiple times daily (mirrors AMFI)</td>
              </tr>
              <tr>
                <td><strong>Best For</strong></td>
                <td>Production backend database</td>
                <td>Frontend apps & dashboards</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-16 text-muted" style={{ fontSize: 13 }}>
          <strong>Recommendation:</strong> For this app, mfapi.in is perfect. For a backend database that powers multiple users, download AMFI's daily file and parse it with a cron job.
        </div>
      </div>

      {/* CAMS / KFin */}
      <div className="card section-full">
        <div className="card-title mb-16">📧 Fetching Portfolio Data from CAMS / KFintech</div>
        <p className="text-muted mb-16" style={{ fontSize: 13 }}>
          Neither CAMS nor KFintech provides a public API. Here's how to automate your portfolio data:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {/* Method 1 */}
          <div style={{ padding: 20, background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📩</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Method 1: CAS Mailback + Parser</div>
            <ol style={{ paddingLeft: 18, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
              <li>Go to <a href="https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement" target="_blank" rel="noopener" style={{ color: 'var(--color-primary)' }}>CAMS</a> or <a href="https://mfs.kfintech.com/investor/General/ConsolidatedAccountStatement" target="_blank" rel="noopener" style={{ color: 'var(--color-primary)' }}>KFintech</a></li>
              <li>Request a Consolidated Account Statement (CAS) via email</li>
              <li>The PDF arrives at your registered email (encrypted with PAN-DOB)</li>
              <li>Use <a href="https://github.com/codereverser/casparser" target="_blank" rel="noopener" style={{ color: 'var(--color-primary)' }}>casparser</a> (Python) to extract data into JSON</li>
              <li>Import the JSON into this app</li>
            </ol>
            <div className="mt-8" style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
              <strong>Automation:</strong> Use Gmail API + OAuth to auto-detect CAS emails, extract PDF, parse with casparser, and update your database via a daily cron job.
            </div>
          </div>

          {/* Method 2 */}
          <div style={{ padding: 20, background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🔗</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Method 2: Account Aggregator (AA) APIs</div>
            <ol style={{ paddingLeft: 18, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
              <li>Register with an Account Aggregator framework provider</li>
              <li>Use APIs from <a href="https://setu.co" target="_blank" rel="noopener" style={{ color: 'var(--color-primary)' }}>Setu</a>, <a href="https://finvu.in" target="_blank" rel="noopener" style={{ color: 'var(--color-primary)' }}>Finvu</a>, or <a href="https://onemoney.in" target="_blank" rel="noopener" style={{ color: 'var(--color-primary)' }}>OneMoney</a></li>
              <li>User gives consent → AA fetches MF data from RTA</li>
              <li>You receive structured portfolio data (JSON)</li>
            </ol>
            <div className="mt-8" style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
              <strong>Best for:</strong> Production apps serving multiple users. Requires business registration and AA licensing.
            </div>
          </div>

          {/* Method 3 */}
          <div style={{ padding: 20, background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Method 3: Browser Automation (DIY)</div>
            <ol style={{ paddingLeft: 18, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
              <li>Use Playwright / Puppeteer / Selenium</li>
              <li>Automate login to CAMS/KFintech portal</li>
              <li>Navigate to CAS download page</li>
              <li>Download and parse the statement</li>
            </ol>
            <div className="mt-8" style={{ fontSize: 12, color: 'var(--color-danger)' }}>
              <strong>⚠️ Caution:</strong> High maintenance. Breaks frequently when RTA websites change. May violate Terms of Service. CAPTCHA handling required.
            </div>
          </div>
        </div>
      </div>

      {/* Automating 1Y/3Y/5Y */}
      <div className="card section-full">
        <div className="card-title mb-16">⚡ Automating Daily 1Y, 3Y, 5Y Performance Updates</div>
        <p className="text-muted mb-16" style={{ fontSize: 13 }}>
          This app already calculates 1Y/3Y/5Y returns in real-time from mfapi.in NAV history. For a backend automation setup:
        </p>

        <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: 20, border: '1px solid var(--color-border)' }}>
          <pre style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
{`# Daily Cron Job Setup (Node.js / Python)

# 1. Download AMFI daily NAV file
curl "https://www.amfiindia.com/spages/NAVAll.txt" -o daily_nav.txt

# 2. Or use mfapi.in for specific schemes
curl "https://api.mfapi.in/mf/{scheme_code}" -o scheme_data.json

# 3. Parse and store in your database (Supabase, MongoDB, etc.)
# 4. Calculate returns:
#    - 1Y: (current_nav / nav_1yr_ago - 1) * 100
#    - 3Y: ((current_nav / nav_3yr_ago)^(1/3) - 1) * 100 (CAGR)
#    - 5Y: ((current_nav / nav_5yr_ago)^(1/5) - 1) * 100 (CAGR)

# 5. Schedule via cron (Linux) or Task Scheduler (Windows)
# Run daily at 11:30 PM IST (after NAV update):
# 30 23 * * * /usr/bin/node /path/to/update_nav.js

# Windows Task Scheduler:
# Action: node C:\\path\\to\\update_nav.js
# Trigger: Daily at 11:30 PM`}
          </pre>
        </div>
      </div>

      {/* Current Architecture */}
      <div className="card section-full">
        <div className="card-title mb-16">🏗️ Current App Architecture</div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Data Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>NAV Data</td>
                <td>api.mfapi.in (real-time JSON API)</td>
                <td><span className="badge badge-success">✅ Live</span></td>
              </tr>
              <tr>
                <td>Scheme Search</td>
                <td>api.mfapi.in/mf/search</td>
                <td><span className="badge badge-success">✅ Live</span></td>
              </tr>
              <tr>
                <td>1Y/3Y/5Y Returns</td>
                <td>Calculated from NAV history</td>
                <td><span className="badge badge-success">✅ Live</span></td>
              </tr>
              <tr>
                <td>Daily P&L</td>
                <td>Today NAV vs Yesterday NAV</td>
                <td><span className="badge badge-success">✅ Live</span></td>
              </tr>
              <tr>
                <td>XIRR</td>
                <td>Newton-Raphson on your transactions</td>
                <td><span className="badge badge-success">✅ Live</span></td>
              </tr>
              <tr>
                <td>Portfolio Holdings</td>
                <td>Manual entry (localStorage)</td>
                <td><span className="badge badge-warning">⚡ Manual</span></td>
              </tr>
              <tr>
                <td>Stock-level Overlap</td>
                <td>Category-based estimates</td>
                <td><span className="badge badge-warning">⚡ Estimated</span></td>
              </tr>
              <tr>
                <td>Auto CAS Import</td>
                <td>CAMS/KFin → casparser</td>
                <td><span className="badge badge-purple">🔮 Guide Provided</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
