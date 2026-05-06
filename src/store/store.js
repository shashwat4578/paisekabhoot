// ==================================================
// store.js — Local storage-based portfolio persistence
// ==================================================

const PORTFOLIO_KEY = 'pkb_portfolio';
const GOALS_KEY = 'pkb_goals';

/**
 * Get portfolio holdings from localStorage.
 * Each holding: {
 *   id, schemeCode, schemeName, fundHouse, category,
 *   transactions: [{ date, amount, nav, units, type }]
 * }
 */
export function getPortfolio() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePortfolio(portfolio) {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
}

/**
 * Add a new holding to the portfolio.
 */
export function addHolding(holding) {
  const portfolio = getPortfolio();
  portfolio.push({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    ...holding,
    transactions: holding.transactions || [],
  });
  savePortfolio(portfolio);
  return portfolio;
}

/**
 * Add a transaction to an existing holding.
 */
export function addTransaction(holdingId, transaction) {
  const portfolio = getPortfolio();
  const holding = portfolio.find(h => h.id === holdingId);
  if (!holding) return portfolio;
  holding.transactions.push({
    id: Date.now().toString(36),
    ...transaction,
  });
  savePortfolio(portfolio);
  return portfolio;
}

/**
 * Remove a holding.
 */
export function removeHolding(holdingId) {
  let portfolio = getPortfolio();
  portfolio = portfolio.filter(h => h.id !== holdingId);
  savePortfolio(portfolio);
  return portfolio;
}

/**
 * Remove a transaction from a holding.
 */
export function removeTransaction(holdingId, transactionId) {
  const portfolio = getPortfolio();
  const holding = portfolio.find(h => h.id === holdingId);
  if (!holding) return portfolio;
  holding.transactions = holding.transactions.filter(t => t.id !== transactionId);
  savePortfolio(portfolio);
  return portfolio;
}

/**
 * Calculate total units for a holding.
 */
export function calcTotalUnits(holding) {
  return holding.transactions.reduce((sum, t) => {
    if (t.type === 'BUY' || t.type === 'SIP') return sum + (t.units || 0);
    if (t.type === 'SELL') return sum - (t.units || 0);
    return sum;
  }, 0);
}

/**
 * Calculate total invested for a holding.
 */
export function calcTotalInvested(holding) {
  return holding.transactions.reduce((sum, t) => {
    if (t.type === 'BUY' || t.type === 'SIP') return sum + (t.amount || 0);
    if (t.type === 'SELL') return sum - (t.amount || 0);
    return sum;
  }, 0);
}

// ============ Goals ============

export function getGoals() {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGoals(goals) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export function addGoal(goal) {
  const goals = getGoals();
  goals.push({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    ...goal,
    taggedHoldings: goal.taggedHoldings || [],
  });
  saveGoals(goals);
  return goals;
}

export function updateGoal(goalId, updates) {
  const goals = getGoals();
  const idx = goals.findIndex(g => g.id === goalId);
  if (idx === -1) return goals;
  goals[idx] = { ...goals[idx], ...updates };
  saveGoals(goals);
  return goals;
}

export function removeGoal(goalId) {
  let goals = getGoals();
  goals = goals.filter(g => g.id !== goalId);
  saveGoals(goals);
  return goals;
}
