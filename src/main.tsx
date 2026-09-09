import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/geist'
import './index.css'
import './styles/themes.css'
import App from './App.tsx'
import { applyAppTheme, readAppTheme } from './lib/appTheme'

// The saved theme paints before React renders, so the first frame is already
// in the palette the person chose.
applyAppTheme(readAppTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
