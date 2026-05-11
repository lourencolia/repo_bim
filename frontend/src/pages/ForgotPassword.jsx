import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { forgotPassword } from '../services/api'
import { KeyRound, Mail, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ForgotPassword() {
  const navigate    = useNavigate()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [resetToken, setResetToken] = useState('')   // retornado apenas em dev

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await forgotPassword(email)
      // Em produção reset_token chega por e-mail — aqui exibimos para demonstração
      setResetToken(res.data.reset_token || '')
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Muitas tentativas. Aguarde um minuto e tente novamente.')
      } else {
        setError('Erro ao processar a solicitação. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  function goToReset() {
    navigate(`/reset-password?token=${encodeURIComponent(resetToken)}`)
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
            Recuperar<br /><span>Acesso</span><br />à Conta
          </h1>
          <p className="brand-subtitle">
            Informe seu e-mail cadastrado. Você receberá um link
            para redefinir sua senha com segurança.
          </p>
          <div className="brand-features">
            {[
              { icon: <Mail size={20} />,    text: 'Token enviado para o e-mail cadastrado' },
              { icon: <KeyRound size={20} />, text: 'Token válido por apenas 15 minutos' },
              { icon: <CheckCircle size={20} />, text: 'Uso único — expira após redefinição' },
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
            <h2 className="auth-card-title">Esqueceu a senha?</h2>
            <p className="auth-card-subtitle">Informe seu e-mail para recuperar o acesso</p>
          </div>

          {error && (
            <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {/* ── Estado: token recebido (dev) ── */}
          {resetToken ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="alert" style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                color: 'var(--text-primary)',
              }}>
                <CheckCircle size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '14px', lineHeight: '1.5' }}>
                  Solicitação registrada. Em produção, o token chegaria por e-mail.
                  Para fins de demonstração, o token está disponível abaixo.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Token de recuperação</label>
                <input
                  className="form-input"
                  value={resetToken}
                  readOnly
                  onClick={e => e.target.select()}
                  style={{ fontFamily: 'monospace', fontSize: '13px', cursor: 'text' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Clique no campo para selecionar. Válido por 15 minutos.
                </span>
              </div>

              <button className="btn-primary" onClick={goToReset}>
                Redefinir senha →
              </button>
            </div>
          ) : (
            /* ── Estado: formulário de e-mail ── */
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="forgot-email">E-mail cadastrado</label>
                <input
                  id="forgot-email"
                  className="form-input"
                  type="email"
                  placeholder="ana@estudio.arq.br"
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  required
                />
              </div>

              <button className="btn-primary" type="submit" disabled={loading || !email}>
                {loading ? <><span className="spinner" /> Processando…</> : 'Enviar instruções →'}
              </button>
            </form>
          )}

          <div className="auth-footer">
            <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeft size={14} /> Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
