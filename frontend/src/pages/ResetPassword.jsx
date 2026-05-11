import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../services/api'
import { KeyRound, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ResetPassword() {
  const navigate      = useNavigate()
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState({
    token:           searchParams.get('token') || '',
    password:        '',
    confirmPassword: '',
  })
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (form.password.length < 12) {
      setError('A senha deve ter no mínimo 12 caracteres.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await resetPassword(form.token, form.password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 429) {
        setError('Muitas tentativas. Aguarde um minuto e tente novamente.')
      } else if (detail) {
        setError(detail)
      } else {
        setError('Erro ao redefinir a senha. Verifique o token e tente novamente.')
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
            Redefinir<br /><span>Nova</span><br />Senha
          </h1>
          <p className="brand-subtitle">
            Cole o token recebido e defina uma nova senha segura para sua conta.
          </p>
          <div className="brand-features">
            {[
              { icon: <KeyRound size={20} />,   text: 'Mínimo de 12 caracteres' },
              { icon: <CheckCircle size={20} />, text: 'Token de uso único — expira após uso' },
              { icon: <ArrowLeft size={20} />,   text: 'Redirecionamento automático ao login' },
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
            <div className="auth-card-icon"><KeyRound size={24} /></div>
            <h2 className="auth-card-title">Nova senha</h2>
            <p className="auth-card-subtitle">Token válido por 15 minutos · uso único</p>
          </div>

          {/* ── Estado: sucesso ── */}
          {success ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <CheckCircle size={48} style={{ color: '#10b981' }} />
              </div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '16px' }}>
                Senha redefinida com sucesso!
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Redirecionando para o login em instantes…
              </p>
              <Link to="/login" className="btn-primary" style={{ textAlign: 'center' }}>
                Ir para o login
              </Link>
            </div>
          ) : (
            /* ── Estado: formulário ── */
            <>
              {error && (
                <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-token">Token de recuperação</label>
                  <input
                    id="reset-token"
                    className="form-input"
                    name="token"
                    type="text"
                    placeholder="Cole o token aqui"
                    value={form.token}
                    onChange={handleChange}
                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reset-password">Nova senha</label>
                  <input
                    id="reset-password"
                    className="form-input"
                    name="password"
                    type="password"
                    placeholder="Mínimo 12 caracteres"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reset-confirm">Confirmar nova senha</label>
                  <input
                    id="reset-confirm"
                    className="form-input"
                    name="confirmPassword"
                    type="password"
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>

                <button
                  className="btn-primary"
                  type="submit"
                  disabled={loading || !form.token || !form.password || !form.confirmPassword}
                >
                  {loading ? <><span className="spinner" /> Salvando…</> : 'Redefinir senha →'}
                </button>
              </form>
            </>
          )}

          <div className="auth-footer">
            <Link to="/forgot-password" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeft size={14} /> Solicitar novo token
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
