import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { getMe } from '../services/api'
import { LayoutDashboard, FolderClosed, Share2, Upload, User, Settings, Menu, X, LogOut } from 'lucide-react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

const NAV_LINKS = [
  { to: '/home',    icon: <LayoutDashboard size={18} />, label: 'Dashboard'      },
  { to: '/files',   icon: <FolderClosed size={18} />,    label: 'Meus Arquivos'  },
  { to: '/shared',  icon: <Share2 size={18} />,          label: 'Compartilhados' },
  { to: '/upload',  icon: <Upload size={18} />,          label: 'Novo Upload'    },
  { to: '/profile', icon: <User size={18} />,            label: 'Meu Perfil'     },
  { to: '/settings', icon: <Settings size={18} />,       label: 'Configurações'  },
]

export default function DashLayout({ children }) {
  const navigate = useNavigate()
  const [user, setUser]         = useState(null)
  const [navOpen, setNavOpen]   = useState(false)

  useEffect(() => {
    getMe()
      .then(r => setUser(r.data))
      .catch(() => {
        localStorage.removeItem('access_token')
        navigate('/login', { replace: true })
      })
  }, [navigate])

  function handleLogout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('temp_token')
    navigate('/login', { replace: true })
  }

  function closeNav() { setNavOpen(false) }

  return (
    <div className="dash-layout">
      {/* ── Top nav ── */}
      <nav className="dash-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Hamburger — visible only on mobile */}
          <button
            className="dash-hamburger"
            onClick={() => setNavOpen(o => !o)}
            aria-label="Menu"
          >
            {navOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className="dash-nav-logo">
            <div className="dash-nav-logo-icon"><Logo size={18} /></div>
            Prumo
          </div>
        </div>

        <div className="dash-nav-right">
          {user && (
            <Link to="/profile" className="dash-user-info" style={{ textDecoration: 'none' }}>
              <span className="dash-user-name">{user.full_name}</span>
              <span className="dash-user-meta">{user.course} · {user.matricula}</span>
            </Link>
          )}
          <ThemeToggle />
          <button className="btn-logout" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </nav>

      <div className="dash-body">
        {/* Mobile overlay backdrop */}
        {navOpen && (
          <div className="dash-overlay" onClick={closeNav} />
        )}

        {/* ── Sidebar ── */}
        <aside className={`dash-sidebar${navOpen ? ' open' : ''}`}>
          {NAV_LINKS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeNav}
              className={({ isActive }) => `dash-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="dash-nav-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </aside>

        {/* ── Main content ── */}
        <main className="dash-content">{children}</main>
      </div>
    </div>
  )
}
