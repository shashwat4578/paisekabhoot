import { supabase } from './supabaseClient'

/**
 * Save user's portfolio to Supabase
 */
export async function saveUserPortfolio(holdings) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('user_portfolios')
    .upsert({ 
      user_id: user.id, 
      holdings: holdings,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })

  if (error) console.error('Error saving portfolio:', error)
}

/**
 * Fetch user's portfolio from Supabase
 */
export async function fetchUserPortfolio() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('user_portfolios')
    .select('holdings')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching portfolio:', error)
    return []
  }

  return data ? data.holdings : []
}
