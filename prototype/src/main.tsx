import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { notify } from './components/shared/toast'

// 原型：所有 alert 改为不打断的右下角提示
window.alert = (message?: unknown) => notify(String(message ?? ''))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
