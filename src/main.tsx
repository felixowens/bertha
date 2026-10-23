import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The server adds this key when BERTHA_REPORT_TO names the project for bertha's own errors.
const reportKey = document.querySelector<HTMLMetaElement>('meta[name="bertha-report"]')?.content
if (reportKey) {
  void import('../sdk/src/browser/index.ts').then(({ init }) =>
    init({ key: reportKey, url: location.origin, release: __BERTHA_VERSION__ }),
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
