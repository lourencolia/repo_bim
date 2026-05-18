import { useState } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { login } from '../services/api'
import { Landmark, Lock, Folder, Key, AlertTriangle, Timer, ShieldAlert } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const sessionExpired  = searchParams.get('expired') === '1'
  const authRequired = location.state?.reason === 'auth_required'
  const [form, setForm]     = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await login({ email: form.email, password: form.password })
      // Save the short-lived pre-2FA token
      localStorage.setItem('temp_token', res.data.token)
      // Remove any stale final token from a previous session
      localStorage.removeItem('access_token')
      navigate('/2fa')
    } catch (err) {
      if (err.response) {
        setError(err.response.data?.detail || 'E-mail ou senha inválidos.')
      } else {
        setError('Erro de conexão com o servidor. Verifique se o backend está rodando.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      {/* ── Left branding panel ── */}
      <div className="auth-brand">
        <div className="brand-content">
          <div className="brand-badge">
            <span className="brand-badge-dot" />
            Repositório BIM Seguro
          </div>
          <h1 className="brand-title">
            Acesso ao<br /><span>Repositório</span><br />de Projetos
          </h1>
          <p className="brand-subtitle">
            Autenticação em duas etapas protege seus projetos BIM 
            com segurança de nível corporativo.
          </p>
          <div className="brand-features">
            {[
              { icon: <Landmark size={20} />, text: 'Plantas, maquetes e modelos 3D' },
              { icon: <Lock size={20} />, text: 'Acesso somente com 2FA ativo' },
              { icon: <Folder size={20} />, text: 'Controle de versão de projetos' },
            ].map((f, idx) => (
              <div className="brand-feature" key={idx}>
                <div className="brand-feature-icon">{f.icon}</div>
                {f.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-card-icon"><Key size={24} /></div>
            <h2 className="auth-card-title">Entrar</h2>
            <p className="auth-card-subtitle">Etapa 1 de 2 — credenciais</p>
          </div>

          {/* Step indicator */}
          <div className="steps">
            <div className="step-dot active" />
            <div className="step-dot" />
          </div>

          {sessionExpired && (
            <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Timer size={16} /> Sessão expirada. Faça login novamente.
            </div>
          )}
          {authRequired && !sessionExpired && (
            <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} /> Você precisa estar logado para acessar essa página.
            </div>
          )}
          {error && (
            <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                className="form-input"
                name="email"
                type="email"
                placeholder="ana@estudio.arq.br"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Senha</label>
              <input
                id="login-password"
                className="form-input"
                name="password"
                type="password"
                placeholder="••••••••••••"
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <div style={{ textAlign: 'right', margin: '-4px 0 12px' }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: '13px', color: 'var(--text-muted)' }}
              >
                Esqueci minha senha
              </Link>
            </div>

            <button
              id="btn-login-submit"
              className="btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? <><span className="spinner" /> Verificando…</> : 'Continuar →'}
            </button>
          </form>

          <div className="auth-footer">
            Não tem conta?{' '}
            <Link to="/register">Criar conta</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
