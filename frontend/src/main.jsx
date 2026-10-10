import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Public pages ship pre-rendered HTML for crawlers (scripts/prerender.js).
// The app renders fresh over it rather than hydrating: the full app tree
// (auth, theme, data providers) isn't what the build rendered.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
