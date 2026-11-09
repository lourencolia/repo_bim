import { useEffect, useState } from 'react'
import { Check, HardDrive, Monitor, Moon, Sun } from 'lucide-react'
import DashLayout from '../components/DashLayout'
import { CORES, aoMudar, corAtual, definirCor, definirTema, preferenciaTema } from '../aparencia'

const TEMAS = [
  { id: 'light',  nome: 'Claro',  icone: <Sun size={16} /> },
  { id: 'dark',   nome: 'Escuro', icone: <Moon size={16} /> },
  { id: 'system', nome: 'Sistema', icone: <Monitor size={16} /> },
]

export default function Settings() {
  const [tema, setTema] = useState(preferenciaTema)
  const [cor, setCor]   = useState(corAtual)

  // Acompanha mudanças feitas pelo botão de sol/lua da barra superior
  useEffect(() => aoMudar(() => { setTema(preferenciaTema()); setCor(corAtual()) }), [])

  return (
    <DashLayout>
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
      </div>

      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title"><span className="settings-num">01</span> Aparência</h2>
        </div>

        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-label">
              <h3>Tema</h3>
              <p>Claro, escuro ou igual ao do seu computador.</p>
            </div>
            <div className="segmented" role="radiogroup" aria-label="Tema">
              {TEMAS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={tema === t.id}
                  className={`segmented-item${tema === t.id ? ' active' : ''}`}
                  onClick={() => definirTema(t.id)}
                >
                  {t.icone} {t.nome}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">
              <h3>Cor de destaque</h3>
              <p>Aparece no card principal do painel, nos links, no seu avatar e nos detalhes.</p>
            </div>
            <div className="swatches" role="radiogroup" aria-label="Cor de destaque">
              {CORES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={cor === c.id}
                  className={`swatch${cor === c.id ? ' active' : ''}`}
                  onClick={() => definirCor(c.id)}
                  title={c.nome}
                >
                  <span className="swatch-dot" style={{ background: c.amostra }}>
                    {cor === c.id && <Check size={15} strokeWidth={3} />}
                  </span>
                  <span className="swatch-name">{c.nome}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prévia ao vivo — usa as mesmas variáveis do resto do app */}
          <div className="settings-row settings-row-preview">
            <div className="settings-label">
              <h3>Prévia</h3>
              <p>Assim os destaques ficam no sistema.</p>
            </div>
            <div className="settings-preview">
              <div className="preview-fill">
                <span className="stat-icon"><HardDrive size={18} /></span>
                <div>
                  <div className="preview-value">183.9 MB</div>
                  <div className="preview-label">Espaço utilizado</div>
                </div>
              </div>
              <div className="preview-side">
                <div className="progress-track"><div className="progress-bar" style={{ width: '64%' }} /></div>
                <div className="preview-links">
                  <span className="preview-avatar">LL</span>
                  <a href="#prévia" onClick={e => e.preventDefault()}>Ver todos →</a>
                  <span className="preview-chip">.ifc</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="settings-note">As preferências ficam salvas neste navegador.</p>
      </section>
    </DashLayout>
  )
}
