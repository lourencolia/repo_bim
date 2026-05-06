import { useEffect, useState } from 'react'
import DashLayout from '../components/DashLayout'
import { getMe, getMyActivity } from '../services/api'
import { Upload, Download, Trash2, Share2, XCircle, Scale } from 'lucide-react'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const ACTION_LABELS = {
  upload:   { label: 'Enviou arquivo',       icon: <Upload size={16} />, color: 'var(--accent)' },
  download: { label: 'Baixou arquivo',        icon: <Download size={16} />, color: 'var(--success)' },
  delete:   { label: 'Excluiu arquivo',       icon: <Trash2 size={16} />, color: 'var(--error)' },
  share:    { label: 'Compartilhou arquivo',  icon: <Share2 size={16} />, color: '#7a9cf0' },
  revoke:   { label: 'Revogou acesso',        icon: <XCircle size={16} />, color: 'var(--text-muted)' },
}

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function Profile() {
  const [user, setUser]         = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([getMe(), getMyActivity()])
      .then(([uRes, aRes]) => { setUser(uRes.data); setActivity(aRes.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <DashLayout>
      <div className="page-header">
        <h1 className="page-title">Meu Perfil</h1>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner-lg" /></div>
      ) : !user ? (
        <div className="empty-state">
          <p className="empty-text">Erro ao carregar perfil.</p>
        </div>
      ) : (
        <div className="profile-layout">
          {/* User card */}
          <div className="profile-card">
            <div className="profile-avatar">{initials(user.full_name)}</div>
            <h2 className="profile-name">{user.full_name}</h2>
            <p className="profile-course">{user.course}</p>

            <div className="profile-fields">
              <div className="profile-field">
                <span className="profile-field-label">Matrícula</span>
                <span className="profile-field-value mono">{user.matricula}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">E-mail</span>
                <span className="profile-field-value">{user.email}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Membro desde</span>
                <span className="profile-field-value">{formatDate(user.created_at)}</span>
              </div>
            </div>

            <div className="profile-lgpd-note">
              <span><Scale size={20} /></span>
              <p>
                Seus dados são tratados conforme a LGPD. O log abaixo é
                sua trilha de auditoria pessoal — você pode solicitar a
                exclusão da conta a qualquer momento.
              </p>
            </div>
          </div>

          {/* Activity log */}
          <div className="profile-activity">
            <div className="section-header" style={{ marginBottom: '0.75rem' }}>
              <h2 className="section-title">Atividade recente</h2>
            </div>

            {activity.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 0' }}>
                <p className="empty-text">Nenhuma atividade registrada ainda.</p>
              </div>
            ) : (
              <div className="activity-list">
                {activity.map((a, i) => {
                  const meta = ACTION_LABELS[a.action] || { label: a.action, icon: '·', color: 'var(--text-muted)' }
                  return (
                    <div key={i} className="activity-item">
                      <div className="activity-icon" style={{ color: meta.color }}>
                        {meta.icon}
                      </div>
                      <div className="activity-info">
                        <span className="activity-label">{meta.label}</span>
                        <span className="activity-file">{a.filename}</span>
                      </div>
                      <span className="activity-time">{formatDateTime(a.accessed_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </DashLayout>
  )
}
