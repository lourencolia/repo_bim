// Aparência do Prumo: tema (claro/escuro/sistema) e cor de destaque.
// A escolha fica no localStorage deste navegador. As cores em si estão no
// index.css, em [data-accent="..."]; aqui só trocamos os atributos do <html>.
// O index.html aplica a mesma lógica antes do React carregar, para não piscar.

export const CORES = [
  { id: 'laranja',  nome: 'Laranja',  amostra: '#FB923C' },
  { id: 'azul',     nome: 'Azul',     amostra: '#60A5FA' },
  { id: 'verde',    nome: 'Verde',    amostra: '#34D399' },
  { id: 'turquesa', nome: 'Turquesa', amostra: '#2DD4BF' },
  { id: 'roxo',     nome: 'Roxo',     amostra: '#A78BFA' },
  { id: 'rosa',     nome: 'Rosa',     amostra: '#F472B6' },
  { id: 'amarelo',  nome: 'Amarelo',  amostra: '#FBBF24' },
]
export const COR_PADRAO = 'laranja'

const CHAVE_TEMA = 'prumo-tema'          // 'light' | 'dark' | 'system'
const CHAVE_COR = 'prumo-destaque'
const EVENTO = 'prumo-aparencia'
const midiaEscura = window.matchMedia('(prefers-color-scheme: dark)')

export function preferenciaTema() {
  return localStorage.getItem(CHAVE_TEMA) || 'system'
}

export function temaEfetivo() {
  const pref = preferenciaTema()
  if (pref === 'system') return midiaEscura.matches ? 'dark' : 'light'
  return pref
}

export function corAtual() {
  const salva = localStorage.getItem(CHAVE_COR)
  return CORES.some(c => c.id === salva) ? salva : COR_PADRAO
}

export function aplicar() {
  document.documentElement.dataset.theme = temaEfetivo()
  document.documentElement.dataset.accent = corAtual()
  window.dispatchEvent(new Event(EVENTO))
}

export function definirTema(pref) {
  localStorage.setItem(CHAVE_TEMA, pref)
  aplicar()
}

export function definirCor(id) {
  localStorage.setItem(CHAVE_COR, id)
  aplicar()
}

// Se a pessoa escolheu "igual ao sistema", acompanha quando o sistema muda
midiaEscura.addEventListener('change', () => {
  if (preferenciaTema() === 'system') aplicar()
})

// Para componentes React reagirem a mudanças feitas em outro lugar
export function aoMudar(callback) {
  window.addEventListener(EVENTO, callback)
  return () => window.removeEventListener(EVENTO, callback)
}
