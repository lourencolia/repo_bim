// Marca do Prumo: o fio e o peso do prumo, a referência vertical da obra.
export default function Logo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="8" width="6" height="2.5" fill="currentColor" />
      <path d="M8 10.5h8L12 23z" fill="currentColor" />
    </svg>
  )
}
