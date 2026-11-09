import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { aoMudar, definirTema, temaEfetivo } from '../aparencia'

// Atalho rápido entre claro e escuro. As opções completas ficam em Configurações.
export default function ThemeToggle({ floating = false }) {
  const [tema, setTema] = useState(temaEfetivo)

  useEffect(() => aoMudar(() => setTema(temaEfetivo())), [])

  const escuro = tema === 'dark'
  return (
    <button
      type="button"
      className={`theme-toggle${floating ? ' theme-toggle-floating' : ''}`}
      onClick={() => definirTema(escuro ? 'light' : 'dark')}
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
    >
      {escuro ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
