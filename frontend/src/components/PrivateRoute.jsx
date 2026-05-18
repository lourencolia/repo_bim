import { Navigate, useLocation } from 'react-router-dom'

export default function PrivateRoute({ children }) {
  const token = localStorage.getItem('access_token')
  const location = useLocation()

  if (token) return children

  return (
    <Navigate
      to="/login"
      replace
      state={{ reason: 'auth_required', from: location.pathname }}
    />
  )
}
