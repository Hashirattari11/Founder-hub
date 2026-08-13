import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { bootstrapOAuthCallbackRedirect } from './components/OAuthCodeRedirect'

// Google OAuth: Supabase sometimes returns to /?code= — forward before first paint.
if (!bootstrapOAuthCallbackRedirect()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
