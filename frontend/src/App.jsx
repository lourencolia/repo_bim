import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Register    from './pages/Register'
import Login       from './pages/Login'
import TwoFactor   from './pages/TwoFactor'
import Home        from './pages/Home'
import MyFiles     from './pages/MyFiles'
import SharedFiles from './pages/SharedFiles'
import Upload      from './pages/Upload'
import Profile     from './pages/Profile'
import NotFound    from './pages/NotFound'
import PrivateRoute from './components/PrivateRoute'

function Protected({ children }) {
  return <PrivateRoute>{children}</PrivateRoute>
}

export default function App() {
  return (
    <>
      {/* Ambient background blobs */}
      <div className="liquid-bg" />
      <div className="liquid-blob-cyan" />

      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/register" element={<Register />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/2fa"      element={<TwoFactor />} />

          {/* Protected */}
          <Route path="/home"    element={<Protected><Home /></Protected>} />
          <Route path="/files"   element={<Protected><MyFiles /></Protected>} />
          <Route path="/shared"  element={<Protected><SharedFiles /></Protected>} />
          <Route path="/upload"  element={<Protected><Upload /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />

          {/* Default + 404 */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

