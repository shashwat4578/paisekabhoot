import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuthContext'

// Wraps any route that requires the user to be logged in.
// While the initial session check is in progress, shows a loading spinner.
// Once resolved: authenticated users see the children, others go to /login.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0a0f1a',
      }}>
        <div className="spinner" />
      </div>
    )
  }

  return user ? children : <Navigate to="/login" replace />
}
