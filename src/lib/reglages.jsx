// Réglages du site modifiables par l'équipe (le logo pour l'instant), chargés une fois au démarrage.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api.js'

export const LOGO_DEFAUT = '/logo-bestclean.webp'
const FAVICON_DEFAUT = '/favicon-bestclean.png'
const CACHE = 'bc-reglages' // évite d'afficher l'ancien logo une fraction de seconde au chargement

const Ctx = createContext({ logo: LOGO_DEFAUT, perso: false, reload: async () => {} })

export function ReglagesProvider({ children }) {
  const [reglages, setReglages] = useState(() => { try { return JSON.parse(localStorage.getItem(CACHE)) || {} } catch { return {} } })
  const reload = useCallback(async () => {
    try {
      const r = await api.getSettings()
      setReglages(r)
      try { localStorage.setItem(CACHE, JSON.stringify(r)) } catch { /* stockage indisponible */ }
    } catch { /* réseau indisponible : on garde ce qu'on a */ }
  }, [])
  useEffect(() => { reload() }, [reload])

  const logo = reglages.logo_url || LOGO_DEFAUT
  useEffect(() => {
    const lien = document.querySelector('link[rel=icon]')
    if (lien) lien.href = reglages.logo_url || FAVICON_DEFAUT
  }, [reglages.logo_url])

  return <Ctx.Provider value={{ logo, perso: !!reglages.logo_url, reload }}>{children}</Ctx.Provider>
}

export const useReglages = () => useContext(Ctx)

export function Logo({ className = '' }) {
  const { logo } = useReglages()
  return <img className={('logo ' + className).trim()} src={logo} alt="" aria-hidden />
}
