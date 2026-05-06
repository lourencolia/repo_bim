import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../services/api'
import TermsModal from '../components/TermsModal'
import { GraduationCap, Lock, Smartphone, Scale, UserPlus, AlertTriangle, CheckCircle, Scale as ScaleIcon } from 'lucide-react'

function getStrength(pw) {
  let score = 0
  if (pw.length >= 12)                         score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw))   score++
  if (/\d/.test(pw))                           score++
  if (/[^A-Za-z0-9]/.test(pw))                score++
  return Math.min(score, 3)
}

const STRENGTH_LABELS = ['Muito fraca', 'Fraca', 'Boa', 'Forte']
const STRENGTH_COLORS = ['#e05a5a', '#e07a5a', '#c9a55a', '#5abf8a']

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    matricula: '',
    full_name: '',
    course: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTerms, setShowTerms]         = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState(false)

  const strength = getStrength(form.password)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!termsAccepted) {
      setError('Você precisa aceitar os Termos de Uso para criar uma conta.')
      return
    }
    if (form.password !== form.confirm) {
      setError('As senhas não coincidem.')
      return
    }
    if (form.password.length < 12) {
      setError('A senha deve ter pelo menos 12 caracteres.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await register({
        matricula:      form.matricula.trim(),
        full_name:      form.full_name.trim(),
        course:         form.course.trim(),
        email:          form.email,
        password:       form.password,
        terms_accepted: true,
      })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      <div className="auth-layout">
        {/* ── Left branding panel ── */}
        <div className="auth-brand">
          <div className="brand-content">
            <div className="brand-badge">
              <span className="brand-badge-dot" />
              Repositório BIM Seguro
            </div>
            <h1 className="brand-title">
              Arquitetura &<br /><span>Urbanismo</span><br />Digital
            </h1>
            <p className="brand-subtitle">
              Gerencie projetos BIM com segurança de nível corporativo.
              Autenticação em duas etapas para proteger cada entrega.
            </p>
            <div className="brand-features">
              {[
                { icon: <GraduationCap size={20} />, text: 'Acesso exclusivo para alunos da universidade' },
                { icon: <Lock size={20} />, text: 'Hash Argon2id com salt único por usuário' },
                { icon: <Smartphone size={20} />, text: 'Autenticação via Google Authenticator' },
                { icon: <Scale size={20} />, text: 'Conformidade com a LGPD e Propriedade Intelectual' },
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
          <div className="auth-card" style={{ maxWidth: 460 }}>
            <div className="auth-card-header">
              <div className="auth-card-icon"><UserPlus size={24} /></div>
              <h2 className="auth-card-title">Criar conta</h2>
              <p className="auth-card-subtitle">Preencha com seus dados acadêmicos</p>
            </div>

            {error && <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} /> {error}</div>}
            {success && <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} /> Conta criada! Redirecionando…</div>}

            <form onSubmit={handleSubmit} noValidate>
              {/* Row: Matrícula + Curso */}
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-matricula">Matrícula</label>
                  <input
                    id="reg-matricula"
                    className="form-input"
                    name="matricula"
                    type="text"
                    placeholder="ex: 2024001234"
                    autoComplete="off"
                    value={form.matricula}
                    onChange={handleChange}
                    required
                    maxLength={20}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-course">Curso</label>
                  <input
                    id="reg-course"
                    className="form-input"
                    name="course"
                    type="text"
                    placeholder="ex: Arquitetura"
                    autoComplete="off"
                    value={form.course}
                    onChange={handleChange}
                    required
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Nome completo</label>
                <input
                  id="reg-name"
                  className="form-input"
                  name="full_name"
                  type="text"
                  placeholder="Ana Lima"
                  autoComplete="name"
                  value={form.full_name}
                  onChange={handleChange}
                  required
                  maxLength={200}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">E-mail</label>
                <input
                  id="reg-email"
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
                <label className="form-label" htmlFor="reg-password">Senha</label>
                <input
                  id="reg-password"
                  className="form-input"
                  name="password"
                  type="password"
                  placeholder="Mínimo 12 caracteres"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                {form.password.length > 0 && (
                  <>
                    <div className="strength-bar-wrap">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="strength-segment"
                          style={{ background: i <= strength ? STRENGTH_COLORS[strength] : undefined }}
                        />
                      ))}
                    </div>
                    <div className="strength-label" style={{ color: STRENGTH_COLORS[strength] }}>
                      {STRENGTH_LABELS[strength]}
                      {strength < 3 && ' — adicione números e símbolos'}
                    </div>
                  </>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">Confirmar senha</label>
                <input
                  id="reg-confirm"
                  className="form-input"
                  name="confirm"
                  type="password"
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Terms checkbox */}
              <div className="terms-row">
                <input
                  id="terms-check"
                  type="checkbox"
                  className="terms-checkbox"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                />
                <label htmlFor="terms-check" className="terms-label">
                  Li e aceito os{' '}
                  <button
                    type="button"
                    className="terms-link"
                    onClick={() => setShowTerms(true)}
                  >
                    Termos de Uso e Política de Privacidade (LGPD)
                  </button>
                </label>
              </div>

              <button
                id="btn-register-submit"
                className="btn-primary"
                type="submit"
                disabled={loading || success || !termsAccepted}
              >
                {loading ? <><span className="spinner" /> Criando conta…</> : 'Criar conta'}
              </button>
            </form>

            <div className="auth-footer">
              Já tem conta?{' '}
              <Link to="/login">Entrar</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
