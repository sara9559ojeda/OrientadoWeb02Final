// Fachada de modales sobre la interfaz única del juego (src/ui/GameUI.js).
// Conserva la API show({ icon, message, buttons }) / hide() que usan GameTracker, VR y World.
export default class ModalManager {
  constructor({ ui } = {}) {
    this.ui = ui
  }

  show({ icon = '', title = '', message = '', buttons = [], variant = 'default' } = {}) {
    if (!this.ui) return

    const actions = Array.isArray(buttons) && buttons.length > 0
      ? buttons.map((btn, i) => ({
        label: btn.text || 'Aceptar',
        variant: btn.variant ?? (i === 0 ? undefined : 'ghost'),
        onClick: btn.onClick,
      }))
      : [{ label: 'Cerrar', onClick: () => {} }]

    this.ui.card({ icon, title, text: message, actions, variant })
  }

  hide() {
    this.ui?.closeCard()
  }
}
