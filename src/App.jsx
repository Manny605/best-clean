import { HashRouter, Route, Routes } from 'react-router-dom'
import { LangProvider } from './lib/i18n.jsx'
import { ReglagesProvider } from './lib/reglages.jsx'
import { Commander, Suivi } from './pages/Public.jsx'
import Admin from './pages/Admin.jsx'

// HashRouter : les liens fonctionnent sur Netlify sans configuration de redirection.
export default function App() {
  return (
    <LangProvider>
      <ReglagesProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Commander />} />
          <Route path="/suivi" element={<Suivi />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </HashRouter>
      </ReglagesProvider>
    </LangProvider>
  )
}
