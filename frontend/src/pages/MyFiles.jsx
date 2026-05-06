import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashLayout from '../components/DashLayout'
import ShareModal from '../components/ShareModal'
import { getMyFiles, deleteFile } from '../services/api'
import { Building, Ruler, FileText, File, FolderOpen, Download, Share2, Trash2, AlertTriangle } from 'lucide-react'

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

export default function MyFiles() {
  const [files, setFiles]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [confirmId, setConfirmId] = useState(null)
  const [deleting, setDeleting]   = useState(false)
  const [shareFile, setShareFile] = useState(null) // file object for ShareModal
  const [error, setError]         = useState('')

  useEffect(() => { fetchFiles() }, [])

  function fetchFiles() {
    setLoading(true)
    getMyFiles()
      .then(r => setFiles(r.data))
      .catch(() => setError('Erro ao carregar arquivos.'))
      .finally(() => setLoading(false))
  }

  async function handleDelete(id) {
    setDeleting(true)
    try {
      await deleteFile(id)
      setFiles(fs => fs.filter(f => f.id !== id))
      setConfirmId(null)
    } catch {
      setError('Erro ao excluir arquivo.')
    } finally {
      setDeleting(false)
    }
  }

  function handleDownload(file) {
    const token = localStorage.getItem('access_token')
    fetch(`http://localhost:8000/files/${file.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.original_filename
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => setError('Erro ao baixar arquivo.'))
  }

  return (
    <>
      {shareFile && (
        <ShareModal
          file={shareFile}
          onClose={() => setShareFile(null)}
        />
      )}

      <DashLayout>
        <div className="page-header">
          <h1 className="page-title">Meus Arquivos</h1>
          <Link to="/upload" className="btn-accent-sm">+ Novo Upload</Link>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} /> {error}</div>}

        {loading ? (
          <div className="empty-state"><div className="spinner-lg" /></div>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FolderOpen size={48} /></div>
            <p className="empty-text">Você ainda não enviou nenhum arquivo.</p>
            <Link to="/upload" className="btn-accent-sm">Fazer primeiro upload</Link>
          </div>
        ) : (
          <div className="files-table-wrap">
            <table className="files-table">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Tamanho</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id}>
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
                    <td className="file-td-size">{formatSize(f.file_size)}</td>
                    <td className="file-td-date">{formatDate(f.uploaded_at)}</td>
                    <td>
                      {confirmId === f.id ? (
                        <div className="confirm-row">
                          <span className="confirm-text">Excluir?</span>
                          <button
                            className="btn-danger-sm"
                            onClick={() => handleDelete(f.id)}
                            disabled={deleting}
                          >
                            {deleting ? '…' : 'Sim'}
                          </button>
                          <button
                            className="btn-ghost-sm"
                            onClick={() => setConfirmId(null)}
                            disabled={deleting}
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <div className="actions-row">
                          <button
                            className="btn-icon"
                            title="Baixar"
                            onClick={() => handleDownload(f)}
                          >
                            <Download size={18} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Compartilhar"
                            onClick={() => setShareFile(f)}
                          >
                            <Share2 size={18} />
                          </button>
                          <button
                            className="btn-icon btn-icon-danger"
                            title="Excluir"
                            onClick={() => setConfirmId(f.id)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashLayout>
    </>
  )
}
