// Panneau qui s'ouvre par-dessus l'écran (en bas sur téléphone, au centre sur ordinateur)
import { useEffect } from 'react'

export default function Feuille({ titre, sousTitre, onClose, children, pied }) {
  useEffect(() => {
    const echap = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [onClose])
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={titre} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div><h2>{titre}</h2>{sousTitre && <p className="muted small">{sousTitre}</p>}</div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="×">×</button>
        </div>
        <div className="sheet-body">{children}</div>
        {pied && <div className="sheet-foot">{pied}</div>}
      </div>
    </div>
  )
}
