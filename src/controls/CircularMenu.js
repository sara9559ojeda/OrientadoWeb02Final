import gsap from 'gsap'

export default class CircularMenu {
  constructor({ container, vrIntegration, onAudioToggle, onWalkMode, onFullscreen }) {
    this.container = container
    this.vrIntegration = vrIntegration
    this.isOpen = false
    this.actionButtons = []

    // Estilo base de los botones
    const baseStyle = `
      position: fixed;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(0, 255, 247, 0.12);
      color: #00fff7;
      font-size: 20px;
      border: 1px solid rgba(0, 255, 247, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 10px #00fff7;
      backdrop-filter: blur(4px);
      z-index: 9999;
      transition: all 0.3s ease;
    `

    const hoverStyle = `
      background: rgba(0, 255, 247, 0.25);
      box-shadow: 0 0 15px #00fff7, 0 0 30px #00fff7;
      transform: scale(1.1);
    `

    // Botón flotante principal ⚙️
    this.toggleButton = document.createElement('button')
    this.toggleButton.innerText = '⚙️'
    this.toggleButton.title = 'Mostrar menú'
    this.toggleButton.setAttribute('aria-label', 'Mostrar menú')
    this.toggleButton.style.cssText = baseStyle + 'top: 80px; right: 20px;'
    container.appendChild(this.toggleButton)
    // Ocultar inicialmente
    this.toggleButton.style.display = 'none'
    this.toggleButton.addEventListener('click', () => this.toggleMenu())

    // Lista de botones de acción
    const actions = [
      { icon: '🔊', title: 'Audio', onClick: onAudioToggle },
      { icon: '🚶', title: 'Modo Caminata', onClick: onWalkMode },
      { icon: '🖥️', title: 'Pantalla Completa', onClick: onFullscreen },
      { icon: '🥽', title: 'Modo VR', onClick: () => this.vrIntegration.toggleVR() },
      { icon: '👨‍💻', title: 'Acerca de', onClick: () => this.showAboutModal() }
    ]

    actions.forEach((action, index) => {
      const btn = document.createElement('button')
      btn.innerText = action.icon
      btn.title = action.title
      btn.setAttribute('aria-label', action.title)

      Object.assign(btn.style, {
        position: 'fixed',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(0, 255, 247, 0.12)',
        color: '#00fff7',
        fontSize: '20px',
        border: '1px solid rgba(0, 255, 247, 0.3)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 10px #00fff7',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        top: `${140 + index * 60}px`,
        right: '20px',
        opacity: '0',
        pointerEvents: 'none'
      })

      btn.addEventListener('click', () => {
        action.onClick()
        this.toggleMenu()
      })

      btn.addEventListener('mouseenter', () => btn.style.cssText += hoverStyle)
      btn.addEventListener('mouseleave', () => btn.style.cssText = btn.style.cssText.replace(hoverStyle, ''))

      this.container.appendChild(btn)
      this.actionButtons.push(btn)
    })

    // HUD: Tiempo - OCULTO
    this.timer = document.createElement('div')
    this.timer.id = 'hud-timer'
    this.timer.innerText = '⏱ 0s'
    Object.assign(this.timer.style, {
      position: 'fixed',
      top: '16px',
      left: '70px',
      fontSize: '16px',
      fontWeight: 'bold',
      background: 'rgba(0,0,0,0.6)',
      color: 'white',
      padding: '6px 12px',
      borderRadius: '8px',
      zIndex: 9999,
      fontFamily: 'monospace',
      pointerEvents: 'none',
      display: 'none' // OCULTO
    })
    document.body.appendChild(this.timer)

    // HUD: Puntos Totales - VISIBLE (esquina superior derecha, arriba del logout)
    this.status = document.createElement('div')
    this.status.id = 'hud-points'
    this.status.innerText = '🎖️ Puntos Totales: 0'
    Object.assign(this.status.style, {
      position: 'fixed',
      top: '16px',
      right: '20px',
      fontSize: '15px',
      fontWeight: 'bold',
      background: 'rgba(0,0,0,0.7)',
      color: '#00fff7',
      padding: '8px 14px',
      borderRadius: '8px',
      zIndex: 9999,
      fontFamily: 'sans-serif',
      pointerEvents: 'none',
      display: 'block', // VISIBLE
      border: '1px solid rgba(0, 255, 247, 0.3)',
      boxShadow: '0 0 10px rgba(0, 255, 247, 0.3)',
      backdropFilter: 'blur(10px)'
    })
    document.body.appendChild(this.status)

    // HUD: Jugadores - OCULTO
    this.playersLabel = document.createElement('div')
    this.playersLabel.id = 'hud-players'
    this.playersLabel.innerText = '👥 Jugadores: 1'
    Object.assign(this.playersLabel.style, {
      position: 'fixed',
      top: '16px',
      left: '140px',
      fontSize: '16px',
      fontWeight: 'bold',
      background: 'rgba(0,0,0,0.6)',
      color: 'white',
      padding: '6px 12px',
      borderRadius: '8px',
      zIndex: 9999,
      fontFamily: 'monospace',
      pointerEvents: 'none',
      display: 'none' // OCULTO
    })
    document.body.appendChild(this.playersLabel)

  }

  //Mostrar modal acerca de
  showAboutModal() {
    if (this.aboutContainer) return // evita duplicados

    this.aboutContainer = document.createElement('div')
    Object.assign(this.aboutContainer.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0, 0, 0, 0.95)',
      padding: '20px',
      borderRadius: '12px',
      color: '#fff',
      zIndex: 10000,
      textAlign: 'center',
      fontFamily: 'sans-serif',
      maxWidth: '300px',
      boxShadow: '0 0 20px #00fff7'
    })

    this.aboutContainer.innerHTML = `
          <h2 style="margin-bottom: 10px;">Proyecto</h2>
          <p style="margin: 0; font-size: 14px;">Proyecto interactivo educativo con Three.js</p>
          <p style="margin: 10px 0 0; font-size: 13px;">Proyecto Final de Programación Orientada a Entornos Multimediales</p>
          <button style="
            margin-top: 12px;
            padding: 6px 14px;
            font-size: 14px;
            background: #00fff7;
            color: black;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          ">Cerrar</button>
        `

    const closeBtn = this.aboutContainer.querySelector('button')
    closeBtn.onclick = () => {
      this.aboutContainer.remove()
      this.aboutContainer = null
    }

    document.body.appendChild(this.aboutContainer)
  }

  toggleMenu() {
    this.isOpen = !this.isOpen

    this.actionButtons.forEach((btn, index) => {
      const delay = index * 0.05
      if (this.isOpen) {
        gsap.to(btn, {
          opacity: 1,
          y: 0,
          pointerEvents: 'auto',
          delay,
          duration: 0.3,
          ease: 'power2.out'
        })
      } else {
        gsap.to(btn, {
          opacity: 0,
          y: -10,
          pointerEvents: 'none',
          delay,
          duration: 0.2,
          ease: 'power2.in'
        })
      }
    })
  }

  setStatus(text) {
    if (this.status) {
      this.status.innerText = text
      // Asegurar que el HUD de puntos esté visible
      if (this.status.style.display === 'none') {
        this.status.style.display = 'block'
      }
    }
  }

  setTimer(seconds) {
    if (this.timer) this.timer.innerText = `⏱ ${seconds}s`
  }
  setPlayerCount(count) {
    if (this.playersLabel) {
      this.playersLabel.innerText = `👥 Jugadores: ${count}`
    }
  }

  destroy() {
    this.toggleButton?.remove()
    this.actionButtons?.forEach(btn => btn.remove())
    this.timer?.remove()
    this.status?.remove()
  }
}
