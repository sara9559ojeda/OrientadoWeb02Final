// Tema claro/oscuro de la interfaz (pantallas de acceso).
// El tema se guarda en <html data-theme="light|dark">; los colores viven como
// variables CSS en src/components/Auth.css.

const STORAGE_KEY = 'app-theme'
const THEME_EVENT = 'app-themechange'

export function getStoredTheme() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    // localStorage puede no estar disponible (modo privado, datos bloqueados)
    return null
  }
}

export function getSystemTheme() {
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
}

export function getTheme() {
  return document.documentElement.dataset.theme || getStoredTheme() || getSystemTheme()
}

export function applyTheme(theme, { persist = false } = {}) {
  document.documentElement.dataset.theme = theme
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // sin persistencia: el tema sigue aplicándose en esta sesión
    }
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next, { persist: true })
  return next
}

// Se llama una vez antes de renderizar React para evitar un parpadeo de tema.
// Prioridad: preferencia guardada > preferencia del sistema operativo.
export function initTheme() {
  applyTheme(getStoredTheme() || getSystemTheme())

  // Si la persona nunca eligió un tema, seguir los cambios del sistema.
  const media = window.matchMedia?.('(prefers-color-scheme: light)')
  media?.addEventListener?.('change', () => {
    if (!getStoredTheme()) applyTheme(getSystemTheme())
  })
}

export function subscribeTheme(callback) {
  const handler = (event) => callback(event.detail)
  window.addEventListener(THEME_EVENT, handler)
  return () => window.removeEventListener(THEME_EVENT, handler)
}
