import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashLayout from '../components/DashLayout'
import { getMyFiles, getSharedWithMe } from '../services/api'
import { Building, Ruler, FileText, File, Files, HardDrive, Users, FolderOpen } from 'lucide-react'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const EXT_ICON = { 
  rvt: <Building size={20} />, ifc: <Building size={20} />, 
  nwd: <Building size={20} />, nwc: <Building size={20} />, 
  pln: <Building size={20} />, dwg: <Ruler size={20} />, 
  dxf: <Ruler size={20} />, pdf: <FileText size={20} /> 
}
function fileIcon(name) {
  return EXT_ICON[name.split('.').pop().toLowerCase()] || <File size={20} />
}

export default function Home() {
  const [myFiles, setMyFiles]       = useState([])
  const [shared, setShared]         = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([getMyFiles(), getSharedWithMe()])
      .then(([mRes, sRes]) => { setMyFiles(mRes.data); setShared(sRes.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalSize = myFiles.reduce((acc, f) => acc + f.file_size, 0)
  const recentMine   = myFiles.slice(0, 5)
  const recentShared = shared.slice(0, 3)

  return (
    <DashLayout>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <Link to="/upload" className="btn-accent-sm">+ Novo Upload</Link>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><Files size={24} /></div>
          <div className="stat-value">{loading ? '…' : myFiles.length}</div>
          <div className="stat-label">Arquivos enviados</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><HardDrive size={24} /></div>
          <div className="stat-value">{loading ? '…' : formatSize(totalSize)}</div>
          <div className="stat-label">Espaço utilizado</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Users size={24} /></div>
          <div className="stat-value">{loading ? '…' : shared.length}</div>
          <div className="stat-label">Compartilhados comigo</div>
        </div>
      </div>

      {/* Meus arquivos recentes */}
      <div className="section-header">
        <h2 className="section-title">Meus arquivos recentes</h2>
        {myFiles.length > 5 && <Link to="/files" className="section-link">Ver todos →</Link>}
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner-lg" /></div>
      ) : recentMine.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><FolderOpen size={48} /></div>
          <p className="empty-text">Nenhum arquivo ainda.</p>
          <Link to="/upload" className="btn-accent-sm">Fazer primeiro upload</Link>
        </div>
      ) : (
        <div className="file-list" style={{ marginBottom: '2rem' }}>
          {recentMine.map(f => (
            <div key={f.id} className="file-row-simple">
              <span className="file-row-icon">{fileIcon(f.original_filename)}</span>
              <div className="file-row-info">
                <span className="file-row-name">{f.original_filename}</span>
                {f.description && <span className="file-row-desc">{f.description}</span>}
              </div>
              <span className="file-row-size">{formatSize(f.file_size)}</span>
              <span className="file-row-date">{formatDate(f.uploaded_at)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Compartilhados comigo */}
      {!loading && recentShared.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">Compartilhados comigo</h2>
            {shared.length > 3 && <Link to="/shared" className="section-link">Ver todos →</Link>}
          </div>
          <div className="file-list">
            {recentShared.map(f => (
              <div key={f.share_id} className="file-row-simple">
                <span className="file-row-icon">{fileIcon(f.original_filename)}</span>
                <div className="file-row-info">
                  <span className="file-row-name">{f.original_filename}</span>
                  <span className="file-row-desc">por {f.shared_by_name} · {f.shared_by_matricula}</span>
                </div>
                <span className="file-row-size">{formatSize(f.file_size)}</span>
                <span className="file-row-date">{formatDate(f.shared_at)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </DashLayout>
  )
}
