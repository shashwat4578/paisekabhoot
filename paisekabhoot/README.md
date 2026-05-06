# paisekabhoot.com — Auth Starter

Full-stack authentication for **paisekabhoot.com** built with **React + Vite + Supabase**.

## Features

- Email + Password login with **OTP email verification** (prevents fake emails)
- Google OAuth 2.0 one-click sign-in
- Forgot password / reset via email link
- Update password page
- Protected routes (redirect to /login if not authenticated)
- Auto session persistence + token refresh
- Supabase Row Level Security on all tables
- Auto-create profile row on sign-up (via DB trigger)
- Fully responsive — mobile + desktop

---

## Project Structure

```
paisekabhoot/
├── index.html
├── vite.config.js
├── package.json
├── .env.example              ← copy to .env and fill in your keys
├── supabase_schema.sql       ← run this in Supabase SQL Editor
└── src/
    ├── main.jsx              ← app entry point
    ├── App.jsx               ← router + AuthProvider
    ├── lib/
    │   ├── supabaseClient.js ← Supabase singleton
    │   └── auth.js           ← all auth functions
    ├── hooks/
    │   └── useAuthContext.jsx← AuthContext + useAuth hook
    ├── components/
    │   ├── Logo.jsx          ← reusable logo SVG
    │   └── ProtectedRoute.jsx← route guard
    ├── pages/
    │   ├── LoginPage.jsx     ← login / signup / forgot / OTP screens
    │   ├── AuthCallback.jsx  ← OAuth redirect handler (/auth/callback)
    │   ├── UpdatePasswordPage.jsx ← after reset email link
    │   └── DashboardPage.jsx ← protected dashboard
    └── styles/
        ├── global.css
        ├── auth.css
        └── dashboard.css
```

---

## Step 1 — Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and create a free project
2. Wait for the project to finish provisioning (~1 min)

---

## Step 2 — Run the database schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Paste the entire contents of `supabase_schema.sql` and click **Run**
3. This creates the `profiles` table, RLS policies, and auto-create triggers

---

## Step 3 — Enable Google OAuth (optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add this to **Authorized redirect URIs**:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
4. Copy the **Client ID** and **Client Secret**
5. In Supabase dashboard → **Authentication → Providers → Google**
6. Paste the Client ID and Secret, toggle **Enable**

---

## Step 4 — Configure Supabase Auth settings

In Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (dev) or your production URL
- **Redirect URLs** — add all of:
  ```
  http://localhost:3000/auth/callback
  http://localhost:3000/auth/update-password
  https://yourdomain.com/auth/callback
  https://yourdomain.com/auth/update-password
  ```

In **Authentication → Email**:
- Enable **"Confirm email"** — this triggers OTP on sign-up
- Set **OTP expiry** to `600` (10 minutes)

---

## Step 5 — Set up environment variables

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Find these in Supabase dashboard → **Settings → API**.

---

## Step 6 — Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Auth Flow Diagram

```
SIGN UP:
  Fill form → signUpWithEmail() → Supabase sends OTP email
           → User enters OTP → verifyEmailOtp()
           → Session created → redirect /dashboard

LOGIN:
  Fill form → loginWithEmail() (validates credentials)
           → sendEmailOtp() → User enters OTP → verifyEmailOtp()
           → Session restored → redirect /dashboard

GOOGLE:
  Click button → signInWithOAuth() → browser → Google
              → Google redirects → /auth/callback
              → getSession() → upsertProfile() → /dashboard

FORGOT PASSWORD:
  Enter email → sendPasswordReset() → email with link
             → User clicks link → /auth/update-password
             → updatePassword() → /dashboard
```

---

## Production deployment

```bash
npm run build   # outputs to /dist
```

Deploy `/dist` to Vercel, Netlify, or any static host.

Remember to update your Supabase **Site URL** and **Redirect URLs** to your production domain.

---

## OTP notes

Supabase uses its own email provider (via SendGrid) by default — no extra setup needed for OTP emails. For production, configure a custom SMTP under **Settings → Auth → SMTP Settings** for better deliverability.

The OTP is a **6-digit numeric code** valid for 10 minutes (configurable). Each login/signup triggers a fresh OTP.
