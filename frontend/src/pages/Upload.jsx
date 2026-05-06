import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashLayout from '../components/DashLayout'
import { uploadFile } from '../services/api'
import { Upload as UploadIcon, File, Scale, AlertTriangle, CheckCircle } from 'lucide-react'

const ACCEPTED = ['.rvt', '.ifc', '.nwd', '.nwc', '.pln', '.dwg', '.dxf', '.pdf']
const MAX_MB = 200

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Upload() {
  const navigate        = useNavigate()
  const inputRef        = useRef()
  const [file, setFile]         = useState(null)
  const [desc, setDesc]         = useState('')
  const [drag, setDrag]         = useState(false)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  function validateAndSet(f) {
    setError('')
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ACCEPTED.includes(ext)) {
      setError(`Tipo não permitido: ${ext}. Aceitos: ${ACCEPTED.join(', ')}`)
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`Arquivo muito grande. Máximo: ${MAX_MB} MB`)
      return
    }
    setFile(f)
  }

  function onDrop(e) {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) validateAndSet(f)
  }

  function onSelect(e) {
    const f = e.target.files[0]
    if (f) validateAndSet(f)
    e.target.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError('')
    setProgress(0)

    try {
      await uploadFile(file, desc, e => {
        setProgress(Math.round((e.loaded / e.total) * 100))
      })
      setSuccess(true)
      setTimeout(() => navigate('/files'), 1800)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao enviar arquivo.')
      setProgress(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashLayout>
      <div className="page-header">
        <h1 className="page-title">Novo Upload</h1>
      </div>

      <div className="upload-wrap">
        <form onSubmit={handleSubmit} noValidate>
          {/* Drop zone */}
          {!file ? (
            <div
              className={`drop-zone${drag ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED.join(',')}
                onChange={onSelect}
                style={{ display: 'none' }}
              />
              <div className="drop-zone-icon"><UploadIcon size={32} /></div>
              <p className="drop-zone-title">Arraste o arquivo aqui</p>
              <p className="drop-zone-sub">ou clique para selecionar</p>
              <div className="drop-zone-types">
                {ACCEPTED.map(e => (
                  <span key={e} className="type-chip">{e}</span>
                ))}
              </div>
              <p className="drop-zone-limit">Tamanho máximo: {MAX_MB} MB</p>
            </div>
          ) : (
            <div className="file-selected">
              <div className="file-selected-info">
                <span className="file-selected-icon"><File size={24} /></span>
                <div>
                  <div className="file-selected-name">{file.name}</div>
                  <div className="file-selected-size">{formatSize(file.size)}</div>
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => { setFile(null); setProgress(0); setError('') }}
              >
                Trocar arquivo
              </button>
            </div>
          )}

          {/* Description */}
          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <label className="form-label" htmlFor="upload-desc">
              Descrição <span style={{ color: 'var(--text-muted)', textTransform: 'none', fontWeight: 400 }}>(opcional)</span>
            </label>
            <textarea
              id="upload-desc"
              className="form-input"
              style={{ resize: 'vertical', minHeight: 80 }}
              placeholder="Descreva o projeto, disciplina, semestre…"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              maxLength={500}
            />
          </div>

          {/* LGPD notice */}
          <div className="lgpd-notice">
            <span className="lgpd-icon"><Scale size={24} /></span>
            <div>
              <strong>Aviso LGPD e Propriedade Intelectual</strong>
              <p>
                Este arquivo será armazenado nos servidores da instituição. A titularidade
                intelectual permanece com você (autor). Ao compartilhá-lo futuramente, o
                destinatário poderá visualizar e baixar o arquivo — você poderá revogar esse
                acesso a qualquer momento. Você pode excluir seus arquivos permanentemente
                quando desejar.
              </p>
            </div>
          </div>

          {error && <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} /> {error}</div>}
          {success && <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} /> Arquivo enviado! Redirecionando…</div>}

          {/* Progress */}
          {loading && (
            <div className="progress-wrap">
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <span className="progress-label">{progress}%</span>
            </div>
          )}

          <button
            className="btn-primary"
            type="submit"
            disabled={!file || loading || success}
            style={{ marginTop: '1rem' }}
          >
            {loading ? <><span className="spinner" /> Enviando…</> : 'Enviar arquivo'}
          </button>
        </form>
      </div>
    </DashLayout>
  )
}
