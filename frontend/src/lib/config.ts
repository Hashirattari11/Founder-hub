const configured = (import.meta.env.VITE_API_URL ?? '').trim()

export const API_URL = configured || (import.meta.env.PROD ? '' : 'http://localhost:8001')
