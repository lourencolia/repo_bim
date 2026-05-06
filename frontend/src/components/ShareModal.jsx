import { useEffect, useState } from 'react'
import { shareFile, getFileShares, revokeShare } from '../services/api'
import { X, Scale, AlertTriangle, CheckCircle } from 'lucide-react'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ShareModal({ file, onClose }) {
  const [matricula, setMatricula]     = useState('')
  const [consent, setConsent]         = useState(false)
  const [sharing, setSharing]         = useState(false)
  const [shareError, setShareError]   = useState('')
  const [shareSuccess, setShareSuccess] = useState('')
  const [shares, setShares]           = useState([])
  const [loadingShares, setLoadingShares] = useState(true)
  const [revoking, setRevoking]       = useState(null) // share_id being revoked

  useEffect(() => {
    fetchShares()
  }, [file.id])

  function fetchShares() {
    setLoadingShares(true)
    getFileShares(file.id)
      .then(r => setShares(r.data))
      .catch(() => {})
      .finally(() => setLoadingShares(false))
  }

  async function handleShare(e) {
    e.preventDefault()
    if (!consent) {
      setShareError('Você precisa confirmar o consentimento para compartilhar.')
      return
    }
    setSharing(true)
    setShareError('')
    setShareSuccess('')
    try {
      await shareFile(file.id, matricula.trim(), true)
      setShareSuccess(`Arquivo compartilhado com sucesso.`)
      setMatricula('')
      setConsent(false)
      fetchShares()
    } catch (err) {
      setShareError(err.response?.data?.detail || 'Erro ao compartilhar arquivo.')
    } finally {
      setSharing(false)
    }
  }

  async function handleRevoke(shareId) {
    setRevoking(shareId)
    try {
      await revokeShare(file.id, shareId)
      setShares(s => s.filter(x => x.share_id !== shareId))
    } catch {
      setShareError('Erro ao revogar acesso.')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Compartilhar arquivo</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {file.original_filename}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>

        <div className="modal-body">
          {/* Share form */}
          <form onSubmit={handleShare} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="share-matricula">Matrícula do destinatário</label>
              <input
                id="share-matricula"
                className="form-input"
                type="text"
                placeholder="ex: 2024001234"
                value={matricula}
                onChange={e => { setMatricula(e.target.value); setShareError(''); setShareSuccess('') }}
                required
                maxLength={20}
              />
            </div>

            {/* LGPD consent */}
            <div className="lgpd-notice" style={{ margin: '0.75rem 0' }}>
              <span className="lgpd-icon"><Scale size={24} /></span>
              <div>
                <strong>Consentimento LGPD</strong>
                <p>
                  Ao compartilhar, o aluno destinatário poderá visualizar e baixar este arquivo.
                  A titularidade intelectual permanece com você. Você pode revogar o acesso
                  a qualquer momento.
                </p>
              </div>
            </div>

            <div className="terms-row" style={{ margin: '0.5rem 0 1rem' }}>
              <input
                id="share-consent"
                type="checkbox"
                className="terms-checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
              />
              <label htmlFor="share-consent" className="terms-label">
                Estou ciente e concordo em compartilhar este arquivo
              </label>
            </div>

            {shareError   && <div className="alert alert-error"   style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} /> {shareError}</div>}
            {shareSuccess && <div className="alert alert-success" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} /> {shareSuccess}</div>}

            <button
              className="btn-primary"
              type="submit"
              disabled={sharing || !matricula.trim() || !consent}
              style={{ marginTop: 0 }}
            >
              {sharing ? <><span className="spinner" /> Compartilhando…</> : 'Compartilhar'}
            </button>
          </form>

          {/* Active shares list */}
          <div style={{ marginTop: '1.75rem' }}>
            <div className="section-header" style={{ marginBottom: '0.5rem' }}>
              <h4 className="section-title" style={{ fontSize: '0.75rem' }}>
                Compartilhado com ({loadingShares ? '…' : shares.length})
              </h4>
            </div>

            {loadingShares ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div className="spinner-lg" style={{ margin: '0 auto' }} />
              </div>
            ) : shares.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                Nenhum compartilhamento ativo.
              </p>
            ) : (
              <div className="share-list">
                {shares.map(s => (
                  <div key={s.share_id} className="share-item">
                    <div className="share-item-avatar">
                      {s.shared_with_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="share-item-info">
                      <span className="share-item-name">{s.shared_with_name}</span>
                      <span className="share-item-meta">
                        {s.shared_with_matricula} · compartilhado em {formatDate(s.shared_at)}
                      </span>
                    </div>
                    <button
                      className="btn-danger-sm"
                      onClick={() => handleRevoke(s.share_id)}
                      disabled={revoking === s.share_id}
                    >
                      {revoking === s.share_id ? '…' : 'Revogar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
