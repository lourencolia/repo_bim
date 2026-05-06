import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { setup2FA, verify2FA } from '../services/api'
import { Smartphone, Camera, CheckCircle, AlertTriangle } from 'lucide-react'

export default function TwoFactor() {
  const navigate  = useNavigate()
  const tempToken = localStorage.getItem('temp_token')

  const [qrBase64, setQrBase64]   = useState(null)
  const [secret, setSecret]       = useState('')
  const [digits, setDigits]       = useState(['', '', '', '', '', ''])
  const [loading, setLoading]     = useState(false)
  const [qrLoading, setQrLoading] = useState(true)
  const [error, setError]         = useState('')
  const inputRefs  = useRef([])
  const fetchedRef  = useRef(false)  // guard against StrictMode double-mount

  // If there's no temp token, redirect back to login
  useEffect(() => {
    if (!tempToken) { navigate('/login', { replace: true }); return }
    if (fetchedRef.current) return   // already called — skip StrictMode second invoke
    fetchedRef.current = true
    fetchQR()
  }, []) // eslint-disable-line

  async function fetchQR() {
    setQrLoading(true)
    try {
      const res = await setup2FA(tempToken)
      setQrBase64(res.data.qr_base64)
      setSecret(res.data.secret)
    } catch (err) {
      setError(
        err.response?.status === 401
          ? 'Sessão expirada. Faça login novamente.'
          : 'Erro ao carregar QR Code. Tente novamente.'
      )
    } finally {
      setQrLoading(false)
    }
  }

  // ── OTP digit input handlers ────────────────────────────────────────────

  function handleDigitChange(index, value) {
    // Only accept a single digit
    const digit = value.replace(/\D/, '').slice(-1)
    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)
    setError('')

    // Auto-advance focus
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits filled
    if (digit && index === 5) {
      const code = [...newDigits.slice(0, 5), digit].join('')
      if (code.length === 6) submitCode(code)
    }
  }

  function handleDigitKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    // Allow paste via Ctrl+V
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) return
  }

  function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const newDigits = text.split('').concat(Array(6).fill('')).slice(0, 6)
    setDigits(newDigits)
    // Focus the last filled input
    const lastIdx = Math.min(text.length, 5)
    inputRefs.current[lastIdx]?.focus()
    if (text.length === 6) submitCode(text)
  }

  // ── Submission ─────────────────────────────────────────────────────────

  async function submitCode(code) {
    setLoading(true)
    setError('')
    try {
      const res = await verify2FA(tempToken, code)
      // Stage 2 complete — save final token and clean up temp
      localStorage.setItem('access_token', res.data.token)
      localStorage.removeItem('temp_token')
      navigate('/home', { replace: true })
    } catch (err) {
      setError(
        err.response?.status === 401
          ? err.response.data?.detail || 'Código inválido ou expirado. Tente novamente.'
          : 'Erro inesperado. Tente novamente.'
      )
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    const code = digits.join('')
    if (code.length < 6) { setError('Digite todos os 6 dígitos.'); return }
    submitCode(code)
  }

  return (
    <div className="auth-layout">
      {/* ── Left branding panel ── */}
      <div className="auth-brand">
        <div className="brand-content">
          <div className="brand-badge">
            <span className="brand-badge-dot" />
            Verificação em 2 Etapas
          </div>
          <h1 className="brand-title">
            Confirme<br />sua <span>identidade</span>
          </h1>
          <p className="brand-subtitle">
            Escaneie o QR Code com o Google Authenticator e insira 
            o código de 6 dígitos gerado pelo aplicativo.
          </p>
          <div className="brand-features">
            {[
              { icon: <Smartphone size={20} />, text: 'Abra o Google Authenticator' },
              { icon: <Camera size={20} />, text: 'Escaneie o QR Code ao lado' },
              { icon: <CheckCircle size={20} />, text: 'Digite o código de 6 dígitos' },
            ].map((f, i) => (
              <div className="brand-feature" key={i}>
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
            <div className="auth-card-icon"><Smartphone size={24} /></div>
            <h2 className="auth-card-title">Autenticação 2FA</h2>
            <p className="auth-card-subtitle">Etapa 2 de 2 — código temporário</p>
          </div>

          {/* Step indicator */}
          <div className="steps">
            <div className="step-dot done" />
            <div className="step-dot active" />
          </div>

          {/* QR Code */}
          <div className="qr-section">
            {qrLoading ? (
              <div className="qr-skeleton" />
            ) : qrBase64 ? (
              <>
                <img
                  src={`data:image/png;base64,${qrBase64}`}
                  alt="QR Code para Google Authenticator"
                />
                <p className="qr-label">Escaneie com o Google Authenticator</p>
                {secret && (
                  <div className="qr-secret" title="Código manual para inserção no app">
                    {secret}
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--error)', fontSize: '0.85rem' }}>
                Não foi possível carregar o QR Code.
              </p>
            )}
          </div>

          {error && (
            <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleManualSubmit} noValidate>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
              Código de 6 dígitos
            </p>

            {/* Individual digit inputs */}
            <div className="otp-input-wrap" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  id={`otp-digit-${i}`}
                  className="otp-digit"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleDigitKeyDown(i, e)}
                  autoFocus={i === 0}
                  autoComplete="one-time-code"
                  disabled={loading}
                />
              ))}
            </div>

            <button
              id="btn-2fa-submit"
              className="btn-primary"
              type="submit"
              disabled={loading || digits.join('').length < 6}
            >
              {loading ? <><span className="spinner" /> Verificando…</> : 'Verificar e Acessar'}
            </button>
          </form>

          <div className="auth-footer">
            <button
              onClick={() => { localStorage.clear(); navigate('/login') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              ← Voltar ao login
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
