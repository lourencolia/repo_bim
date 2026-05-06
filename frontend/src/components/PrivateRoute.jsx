import { Navigate } from 'react-router-dom'

/**
 * PrivateRoute — wraps a component and redirects to /login
 * if no final access token is found in localStorage.
 *
 * Only the `access_token` (stage: "authenticated") grants entry.
 * The temp_token (stage: "pre_2fa") is intentionally NOT accepted here.
 */
export default function PrivateRoute({ children }) {
  const token = localStorage.getItem('access_token')
  return token ? children : <Navigate to="/login" replace />
}
