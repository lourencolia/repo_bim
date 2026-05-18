import { useEffect, useState } from 'react'
import DashLayout from '../components/DashLayout'
import { getSharedWithMe } from '../services/api'
import { Building, Ruler, FileText, File, Users, Eye, AlertTriangle } from 'lucide-react'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const EXT_ICON = { 
  rvt: <Building size={20} />, ifc: <Building size={20} />, 
  nwd: <Building size={20} />, nwc: <Building size={20} />, 
  pln: <Building size={20} />, dwg: <Ruler size={20} />, 
  dxf: <Ruler size={20} />, pdf: <FileText size={20} /> 
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase()
  return EXT_ICON[ext] || <File size={20} />
}

export default function SharedFiles() {
  const [files, setFiles]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    getSharedWithMe()
      .then(r => setFiles(r.data))
      .catch(() => setError('Erro ao carregar arquivos compartilhados.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <DashLayout>
      <div className="page-header">
        <h1 className="page-title">Compartilhados comigo</h1>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} /> {error}</div>}

      {loading ? (
        <div className="empty-state"><div className="spinner-lg" /></div>
      ) : files.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Users size={48} /></div>
          <p className="empty-text">Nenhum arquivo foi compartilhado com você ainda.</p>
        </div>
      ) : (
        <div className="files-table-wrap">
          <table className="files-table">
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Compartilhado por</th>
                <th>Tamanho</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.share_id}>
                  <td>
                    <div className="file-cell">
                      <span className="file-cell-icon">{fileIcon(f.original_filename)}</span>
                      <div>
                        <div className="file-cell-name">{f.original_filename}</div>
                        {f.description && (
                          <div className="file-cell-desc">{f.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="shared-by-cell">
                      <span className="shared-by-name">{f.shared_by_name}</span>
                      <span className="shared-by-meta">{f.shared_by_matricula}</span>
                    </div>
                  </td>
                  <td className="file-td-size">{formatSize(f.file_size)}</td>
                  <td className="file-td-date">{formatDate(f.shared_at)}</td>
                  <td>
                    <span className="badge-view-only" title="Somente visualização">
                      <Eye size={14} /> Somente visualização
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashLayout>
  )
}
