import { supabase } from './supabaseClient'

// ─────────────────────────────────────────────────────────────────────────────
// SIGN UP WITH EMAIL + PASSWORD
// Creates the auth user, then inserts a row into public.profiles
// After sign-up, Supabase sends a confirmation email with an OTP automatically
// ─────────────────────────────────────────────────────────────────────────────
export async function signUpWithEmail(fullName, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }, // stored in auth.users.raw_user_meta_data
    },
  })
  if (error) throw error

  // Insert profile row — only if user object returned (email not already registered)
  if (data.user && !data.user.identities?.length === 0) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      email,
      created_at: new Date().toISOString(),
    })
    if (profileError) throw profileError
  }

  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN WITH EMAIL + PASSWORD
// Validates credentials, then sends an OTP for 2-step verification
// ─────────────────────────────────────────────────────────────────────────────
export async function loginWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data // { user, session }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND OTP TO EMAIL
// Use type 'signup' for new users, 'magiclink' / 'email' for existing users
// shouldCreateUser: false = only send OTP if the email already exists in auth
// ─────────────────────────────────────────────────────────────────────────────
export async function sendEmailOtp(email, shouldCreateUser = false) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser,
    },
  })
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY OTP
// token = the 6-digit code the user entered
// type  = 'signup' for new registrations, 'email' for login OTP
// Returns { user, session } on success
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyEmailOtp(email, token, type = 'email') {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type })
  if (error) throw error
  return data // { user, session }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESEND OTP / CONFIRMATION EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export async function resendOtp(email, type = 'signup') {
  const { error } = await supabase.auth.resend({ type, email })
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH
// Redirects browser to Google — no further code runs after this call
// After Google auth, browser lands on /auth/callback
// ─────────────────────────────────────────────────────────────────────────────
export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — sends reset link to email
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/update-password`,
  })
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PASSWORD — called after user clicks reset link in email
// ─────────────────────────────────────────────────────────────────────────────
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGN OUT
// ─────────────────────────────────────────────────────────────────────────────
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// GET CURRENT SESSION (from localStorage — no network call)
// ─────────────────────────────────────────────────────────────────────────────
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  return session
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH USER PROFILE from public.profiles table
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data // { id, full_name, email, avatar_url, created_at }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPSERT PROFILE — create or update profile row
// ─────────────────────────────────────────────────────────────────────────────
export async function upsertProfile(userId, profileData) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...profileData, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH STATE LISTENER — call once at app root
// Fires on: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY
// Returns the subscription — call .unsubscribe() on component unmount
// ─────────────────────────────────────────────────────────────────────────────
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      let profile = null
      if (session?.user) {
        try {
          profile = await getUserProfile(session.user.id)
        } catch {
          // Profile may not exist yet for brand-new OAuth users
          profile = null
        }
      }
      callback(event, session, profile)
    }
  )
  return subscription
}
