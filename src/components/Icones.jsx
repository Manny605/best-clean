// Petites icônes au trait pour les articles (par code d'article) et l'interface.
const priere = <><path d="M6 21V9a6 6 0 0 1 12 0v12z" /><path d="M9.5 21v-8a2.5 2.5 0 0 1 5 0v8" /></>
const ARTICLES = {
  couverture: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10.5h18M3 14h18" /></>,
  couvre_lit: <><path d="M3 18V9.5A2.5 2.5 0 0 1 5.5 7h13A2.5 2.5 0 0 1 21 9.5V18" /><path d="M2 18h20M3 13h18M7 10h3" /></>,
  drap: <><path d="M5 3h14v18H5z" /><path d="M5 8h14M9 3v5" /></>,
  rideau: <><path d="M2 4h20" /><path d="M5 4v16c2.5-2 4-6 4-11V4M19 4v16c-2.5-2-4-6-4-11V4" /></>,
  oreiller: <><path d="M4 9c0-2 1.5-3.5 4-3.5h8c2.5 0 4 1.5 4 3.5v6c0 2-1.5 3.5-4 3.5H8c-2.5 0-4-1.5-4-3.5z" /><path d="M8 10.5c2.5 1 5.5 1 8 0" /></>,
  tapis_priere: priere,
  sajjada: priere,
  housse: <><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M8.5 5v3h7V5" /></>,
}
const DEFAUT = <><path d="M12 3c3 4 6 7.2 6 10.5A6 6 0 0 1 6 13.5C6 10.2 9 7 12 3z" /></>

export function IconeArticle({ code }) {
  return (
    <svg className="art-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ARTICLES[code] || DEFAUT}
    </svg>
  )
}

// Schéma « comment mesurer » : un tapis avec ses deux cotes
export function SchemaMesure({ longueur, largeur }) {
  return (
    <svg className="measure" viewBox="0 0 176 76" aria-hidden>
      <rect x="6" y="6" width="104" height="44" rx="3" className="measure-rug" />
      <rect x="13" y="13" width="90" height="30" rx="2" className="measure-in" />
      <path d="M6 59h104M6 55v8M110 55v8M120 6v44M116 6h8M116 50h8" className="measure-line" />
      <text x="58" y="73" textAnchor="middle">{longueur}</text>
      <text x="128" y="31" textAnchor="start">{largeur}</text>
    </svg>
  )
}
