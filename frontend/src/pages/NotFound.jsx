import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  const hasSession = !!localStorage.getItem('access_token')

  return (
    <div className="notfound-layout">
      <div className="notfound-content">
        <div className="notfound-code">404</div>
        <h1 className="notfound-title">Página não encontrada</h1>
        <p className="notfound-sub">
          O endereço que você tentou acessar não existe neste sistema.
        </p>
        <button
          className="btn-primary"
          style={{ marginTop: '2rem', maxWidth: 220 }}
          onClick={() => navigate(hasSession ? '/home' : '/login')}
        >
          {hasSession ? 'Voltar ao início' : 'Ir para o login'}
        </button>
      </div>
    </div>
  )
}
