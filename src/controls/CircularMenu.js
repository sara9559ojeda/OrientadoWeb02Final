import gsap from 'gsap'

// Menú de ajustes (audio, caminata, pantalla completa, VR, acerca de).
// Los estilos viven en src/ui/game-ui.css (clase gu-menu-btn).
const TOP_START = 118 // debajo de los puntos y del usuario
const STEP = 52

export default class CircularMenu {
  constructor({ container, ui, vrIntegration, onAudioToggle, onWalkMode, onFullscreen }) {
    this.container = container
    this.ui = ui
    this.vrIntegration = vrIntegration
    this.isOpen = false
    this.actionButtons = []

    const edge = 'clamp(10px, 2vw, 18px)'

    // Botón principal de ajustes (oculto hasta que empieza la partida)
    this.toggleButton = document.createElement('button')
    this.toggleButton.type = 'button'
    this.toggleButton.className = 'gu-menu-btn'
    this.toggleButton.textContent = '⚙️'
    this.toggleButton.title = 'Ajustes'
    this.toggleButton.setAttribute('aria-label', 'Ajustes')
    this.toggleButton.setAttribute('aria-expanded', 'false')
    this.toggleButton.style.top = `${TOP_START}px`
    this.toggleButton.style.right = edge
    this.toggleButton.style.display = 'none'
    this.toggleButton.addEventListener('click', () => this.toggleMenu())
    container.appendChild(this.toggleButton)

    const actions = [
      { icon: '🔊', title: 'Audio', onClick: onAudioToggle },
      { icon: '🚶', title: 'Modo caminata', onClick: onWalkMode },
      { icon: '🖥️', title: 'Pantalla completa', onClick: onFullscreen },
      { icon: '🥽', title: 'Modo VR', onClick: () => this.vrIntegration.toggleVR() },
      { icon: '🎙️', title: 'Voz de Aurora (narradora)', onClick: () => window.experience?.world?.narrator?.toggle() },
      { icon: '🧠', title: 'Panel de IA (tecla I)', onClick: () => window.experience?.world?.toggleAIPanel() },
      { icon: '↺', title: 'Reiniciar partida', onClick: () => this.confirmRestart() },
      { icon: 'ℹ️', title: 'Acerca del juego', onClick: () => this.showAboutModal() },
    ]

    actions.forEach((action, index) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'gu-menu-btn'
      btn.textContent = action.icon
      btn.title = action.title
      btn.setAttribute('aria-label', action.title)
      btn.style.top = `${TOP_START + STEP * (index + 1)}px`
      btn.style.right = edge
      btn.style.opacity = '0'
      btn.style.pointerEvents = 'none'
      btn.addEventListener('click', () => {
        action.onClick()
        this.toggleMenu()
      })
      container.appendChild(btn)
      this.actionButtons.push(btn)
    })
  }

  confirmRestart() {
    this.ui?.card({
      title: '¿Reiniciar la partida?',
      text: 'Volverás al inicio y perderás tu progreso actual.',
      actions: [
        { label: 'Reiniciar', variant: 'danger', onClick: () => window.experience?.resetGame() },
        { label: 'Seguir jugando', variant: 'ghost', onClick: () => {} },
      ],
    })
  }

  showAboutModal() {
    this.ui?.card({
      kicker: 'Acerca del juego',
      title: 'Núcleo Perdido',
      paragraphs: [
        'Proyecto interactivo con Three.js, cannon-es y enemigos con IA (Yuka).',
        'Proyecto final de Programación Orientada a Entornos Multimediales.',
      ],
      actions: [{ label: 'Cerrar', variant: 'ghost', onClick: () => {} }],
    })
  }

  toggleMenu() {
    this.isOpen = !this.isOpen
    this.toggleButton.setAttribute('aria-expanded', String(this.isOpen))

    this.actionButtons.forEach((btn, index) => {
      const delay = index * 0.05
      if (this.isOpen) {
        gsap.to(btn, { opacity: 1, y: 0, pointerEvents: 'auto', delay, duration: 0.3, ease: 'power2.out' })
      } else {
        gsap.to(btn, { opacity: 0, y: -10, pointerEvents: 'none', delay, duration: 0.2, ease: 'power2.in' })
      }
    })
  }

  // El temporizador y el contador de jugadores ya no se muestran; se mantienen
  // los métodos porque GameTracker y SocketManager los siguen invocando.
  setTimer() {}
  setPlayerCount() {}

  destroy() {
    this.toggleButton?.remove()
    this.actionButtons?.forEach((btn) => btn.remove())
  }
}
