import { useState, useEffect } from 'react'
import { getGoals, saveGoals, addGoal, updateGoal, removeGoal, getPortfolio, calcTotalUnits } from '../store/store'

export default function GoalTagging() {
  const [goals, setGoals] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [liveValues, setLiveValues] = useState({}) // schemeCode -> currentValue per unit

  useEffect(() => {
    setGoals(getGoals())
    setPortfolio(getPortfolio())
  }, [])

  // Fetch live NAV for portfolio to calc current value
  useEffect(() => {
    const fetchNav = async () => {
      const p = getPortfolio()
      const codes = [...new Set(p.map(h => h.schemeCode))]
      const values = {}
      await Promise.all(codes.map(async (code) => {
        try {
          const res = await fetch(`https://api.mfapi.in/mf/${code}`)
          const data = await res.json()
          if (data.status === 'SUCCESS' && data.data?.length > 0) {
            values[code] = parseFloat(data.data[0].nav)
          }
        } catch {}
      }))
      setLiveValues(values)
    }
    fetchNav()
  }, [])

  const handleAddGoal = (goalData) => {
    const updated = addGoal(goalData)
    setGoals(updated)
    setShowAddModal(false)
  }

  const handleTagHolding = (goalId, holdingId) => {
    const goal = goals.find(g => g.id === goalId)
    if (!goal || goal.taggedHoldings.includes(holdingId)) return
    const updated = updateGoal(goalId, {
      taggedHoldings: [...goal.taggedHoldings, holdingId],
    })
    setGoals(updated)
  }

  const handleUntagHolding = (goalId, holdingId) => {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return
    const updated = updateGoal(goalId, {
      taggedHoldings: goal.taggedHoldings.filter(id => id !== holdingId),
    })
    setGoals(updated)
  }

  const handleDeleteGoal = (goalId) => {
    if (!confirm('Delete this goal?')) return
    const updated = removeGoal(goalId)
    setGoals(updated)
  }

  // Calculate current value of tagged holdings for a goal
  const getGoalCurrentValue = (goal) => {
    return goal.taggedHoldings.reduce((sum, holdingId) => {
      const holding = portfolio.find(h => h.id === holdingId)
      if (!holding) return sum
      const units = calcTotalUnits(holding)
      const nav = liveValues[holding.schemeCode]
      if (!nav) return sum
      return sum + units * nav
    }, 0)
  }

  const fmt = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '—'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
  }

  const GOAL_ICONS = {
    retirement: '🏖️',
    house: '🏠',
    car: '🚗',
    education: '🎓',
    wedding: '💍',
    travel: '✈️',
    emergency: '🛡️',
    custom: '🎯',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-24">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Goal Tagging</h1>
          <p className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>
            Tag your mutual fund holdings to financial goals and track progress
          </p>
        </div>
        <button className="btn btn-primary" id="add-goal-btn" onClick={() => setShowAddModal(true)}>
          + New Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🎯</div>
            <div className="empty-state-title">No Goals Created</div>
            <div className="empty-state-text">
              Create a financial goal (e.g., Retirement, Car, Education) and tag your mutual fund holdings to track progress toward each goal.
            </div>
            <button className="btn btn-primary mt-16" onClick={() => setShowAddModal(true)}>
              Create Your First Goal
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
          {goals.map(goal => {
            const currentValue = getGoalCurrentValue(goal)
            const target = goal.targetAmount || 0
            const progress = target > 0 ? Math.min((currentValue / target) * 100, 100) : 0
            const icon = GOAL_ICONS[goal.type] || GOAL_ICONS.custom

            return (
              <div key={goal.id} className="card" style={{ position: 'relative' }}>
                <div className="flex items-center justify-between mb-16">
                  <div className="flex items-center gap-12">
                    <span style={{ fontSize: 28 }}>{icon}</span>
                    <div>
                      <div className="card-title">{goal.name}</div>
                      <div className="card-subtitle">Target: {fmt(target)} · Deadline: {goal.deadline || 'Not set'}</div>
                    </div>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteGoal(goal.id)}>✕</button>
                </div>

                {/* Progress */}
                <div className="mb-16">
                  <div className="flex justify-between mb-8">
                    <span className="text-muted" style={{ fontSize: 12 }}>Progress</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: progress >= 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>
                      {progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className={`progress-bar-fill ${progress >= 100 ? 'green' : 'blue'}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-8">
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>{fmt(currentValue)}</span>
                    <span className="text-dim" style={{ fontSize: 12 }}>of {fmt(target)}</span>
                  </div>
                </div>

                {/* Tagged Holdings */}
                <div>
                  <div className="form-label">Tagged Holdings</div>
                  {goal.taggedHoldings.length === 0 ? (
                    <div className="text-dim" style={{ fontSize: 12, padding: '8px 0' }}>No holdings tagged yet</div>
                  ) : (
                    <div className="flex gap-8" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
                      {goal.taggedHoldings.map(hId => {
                        const h = portfolio.find(p => p.id === hId)
                        if (!h) return null
                        return (
                          <span key={hId} className="tag-chip removable" onClick={() => handleUntagHolding(goal.id, hId)}>
                            {h.schemeName.substring(0, 30)}... ✕
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Add holding selector */}
                  {portfolio.filter(h => !goal.taggedHoldings.includes(h.id)).length > 0 && (
                    <select
                      className="form-select"
                      style={{ fontSize: 12 }}
                      value=""
                      onChange={e => e.target.value && handleTagHolding(goal.id, e.target.value)}
                    >
                      <option value="">+ Tag a holding...</option>
                      {portfolio
                        .filter(h => !goal.taggedHoldings.includes(h.id))
                        .map(h => (
                          <option key={h.id} value={h.id}>{h.schemeName}</option>
                        ))
                      }
                    </select>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Create New Goal</div>
            <GoalForm onSubmit={handleAddGoal} onCancel={() => setShowAddModal(false)} />
          </div>
        </div>
      )}
    </div>
  )
}


function GoalForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('custom')
  const [targetAmount, setTargetAmount] = useState('')
  const [deadline, setDeadline] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name || !targetAmount) return
    onSubmit({
      name,
      type,
      targetAmount: parseFloat(targetAmount),
      deadline,
      taggedHoldings: [],
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Goal Name</label>
        <input className="form-input" placeholder="e.g. Retirement Fund" value={name} onChange={e => setName(e.target.value)} autoFocus />
      </div>
      <div className="form-group">
        <label className="form-label">Goal Type</label>
        <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
          <option value="retirement">🏖️ Retirement</option>
          <option value="house">🏠 House</option>
          <option value="car">🚗 Car</option>
          <option value="education">🎓 Education</option>
          <option value="wedding">💍 Wedding</option>
          <option value="travel">✈️ Travel</option>
          <option value="emergency">🛡️ Emergency Fund</option>
          <option value="custom">🎯 Custom</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Target Amount (₹)</label>
        <input className="form-input" type="number" placeholder="e.g. 5000000" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Target Date (optional)</label>
        <input className="form-input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
      </div>
      <div className="flex gap-8 mt-16">
        <button type="submit" className="btn btn-primary" id="confirm-add-goal">Create Goal</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
