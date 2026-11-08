// Interfaz única del juego (HUD, tarjetas, avisos y brújula).
// Se construye con DOM seguro (textContent, nunca innerHTML) y se estiliza en game-ui.css.
import './game-ui.css'
import { CONTROLS } from '../story.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Crea un elemento con clase, texto y atributos. */
function h(tag, className, text, attrs) {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (text !== undefined && text !== null) el.textContent = text
  if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
  return el
}

function arrowIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2.5')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', 'M12 19V5M5 12l7-7 7 7')
  svg.appendChild(path)
  return svg
}

export default class GameUI {
  constructor() {
    this.root = h('div', 'gu-root')
    this.root.setAttribute('data-game-ui', '')

    this._buildLeft()
    this._buildRight()
    this._buildCompass()
    this._buildAIPanel()

    this.toasts = h('div', 'gu-toasts', null, { role: 'status', 'aria-live': 'polite' })
    this.root.appendChild(this.toasts)

    document.body.appendChild(this.root)
    this.cardBackdrop = null
  }

  // ── HUD ─────────────────────────────────────────────────
  _buildLeft() {
    const left = h('div', 'gu-hud-left')

    this.chapter = h('div', 'gu-panel gu-chapter')
    this.chapterKicker = h('div', 'gu-kicker', '')
    this.chapterTitle = h('div', 'gu-chapter-title', '')
    this.chapter.append(this.chapterKicker, this.chapterTitle)

    this.objective = h('div', 'gu-panel gu-objective')
    this.objectiveLabel = h('div', 'gu-kicker', 'Objetivo')
    this.objectiveText = h('div', 'gu-objective-text', '')
    const row = h('div', 'gu-progress-row')
    this.coinsLabel = h('span', null, 'Fragmentos de núcleo')
    this.coinsCount = h('strong', null, '0 / 0')
    row.append(this.coinsLabel, this.coinsCount)
    this.progress = h('div', 'gu-progress')
    this.progress.setAttribute('role', 'progressbar')
    this.progress.setAttribute('aria-label', 'Fragmentos recuperados')
    this.progress.setAttribute('aria-valuemin', '0')
    this.progressBar = h('span')
    this.progress.appendChild(this.progressBar)
    this.objective.append(this.objectiveLabel, this.objectiveText, row, this.progress)

    this.noise = h('div', 'gu-panel gu-noise')
    this.noiseLabel = h('span', 'gu-noise-label', 'Ruido')
    this.noiseBars = h('span', 'gu-noise-bars', null, { 'aria-hidden': 'true' })
    for (let i = 0; i < 3; i++) this.noiseBars.appendChild(h('i'))
    this.noiseValue = h('strong', 'gu-noise-value', 'Silencioso')
    this.noise.append(this.noiseLabel, this.noiseBars, this.noiseValue)
    this.noise.title = 'Los mutantes oyen según tu ruido: correr y saltar se oye de lejos'

    this.skipBtn = h('button', 'gu-link gu-skip', '')
    this.skipBtn.type = 'button'
    this.skipBtn.hidden = true

    left.append(this.chapter, this.objective, this.noise, this.skipBtn)
    this.root.appendChild(left)
  }

  _buildRight() {
    const right = h('div', 'gu-hud-right')
    this.points = h('div', 'gu-panel gu-points')
    this.pointsValue = h('strong', null, '0')
    this.points.append(h('span', null, 'Puntos'), this.pointsValue)
    right.appendChild(this.points)
    this.root.appendChild(right)
  }

  _buildCompass() {
    this.compass = h('div', 'gu-panel gu-compass')
    this.compass.hidden = true
    this.compassArrow = h('div', 'gu-compass-arrow')
    this.compassIcon = arrowIcon()
    this.compassArrow.appendChild(this.compassIcon)
    this.compassLabel = h('div', 'gu-compass-label')
    this.compassTitle = h('span', null, '')
    this.compassDist = h('small', null, '')
    this.compassLabel.append(this.compassTitle, this.compassDist)
    this.compass.append(this.compassArrow, this.compassLabel)
    this.root.appendChild(this.compass)
  }

  setChapter(kicker, title) {
    this.chapterKicker.textContent = kicker
    this.chapterTitle.textContent = title
  }

  setObjective(text, done = false) {
    this.objectiveText.textContent = text
    this.objective.classList.toggle('is-done', done)
  }

  setCoins(collected, total) {
    const pct = total > 0 ? Math.min(100, (collected / total) * 100) : 0
    this.coinsCount.textContent = `${collected} / ${total}`
    this.progressBar.style.width = `${pct}%`
    this.progress.setAttribute('aria-valuemax', String(total))
    this.progress.setAttribute('aria-valuenow', String(collected))
  }

  setPoints(value) {
    this.pointsValue.textContent = String(value)
  }

  /** Atajo para saltar de nivel; label=null lo oculta. */
  setSkip(label, onClick) {
    if (!label) {
      this.skipBtn.hidden = true
      this.skipBtn.onclick = null
      return
    }
    this.skipBtn.textContent = label
    this.skipBtn.hidden = false
    this.skipBtn.onclick = onClick
  }

  /**
   * Brújula: info = { angle (rad, 0 = delante), distance (m), kind: 'coin' | 'portal' } o null para ocultar.
   */
  setCompass(info) {
    if (!info) {
      if (!this.compass.hidden) this.compass.hidden = true
      return
    }
    if (this.compass.hidden) this.compass.hidden = false
    const isPortal = info.kind === 'portal'
    this.compass.classList.toggle('is-portal', isPortal)
    const title = isPortal ? 'Portal' : 'Fragmento más cercano'
    if (this.compassTitle.textContent !== title) this.compassTitle.textContent = title
    this.compassDist.textContent = `${Math.round(info.distance)} m`
    this.compassIcon.style.transform = `rotate(${info.angle}rad)`
  }

  /** Medidor de ruido del jugador: level = { id, label, bars }. */
  setNoise(level) {
    this.noise.dataset.level = level.id
    this.noiseValue.textContent = level.label
    Array.from(this.noiseBars.children).forEach((bar, i) => bar.classList.toggle('on', i < level.bars))
  }

  // ── Panel de IA ─────────────────────────────────────────
  _buildAIPanel() {
    this.aiPanel = h('aside', 'gu-panel gu-ai', null, { 'aria-label': 'Panel de IA de los enemigos' })
    this.aiPanel.hidden = true
    const head = h('div', 'gu-ai-head')
    head.append(h('strong', null, 'IA de los mutantes'), h('span', 'gu-kicker', 'Tecla I'))
    this.aiList = h('ul', 'gu-ai-list')
    this.aiFeed = h('ul', 'gu-ai-feed', null, { 'aria-live': 'polite' })
    const legend = h('p', 'gu-ai-legend', 'Cono = vista · anillo rojo = alarma · ❓ investiga · ❗ persigue · 🎯 flanquea · 🔍 busca')
    this.aiPanel.append(head, this.aiList, h('div', 'gu-kicker', 'Eventos'), this.aiFeed, legend)
    this.root.appendChild(this.aiPanel)
    this.aiFeedItems = []
  }

  get aiPanelVisible() {
    return !this.aiPanel.hidden
  }

  setAIPanelVisible(on) {
    this.aiPanel.hidden = !on
  }

  /** rows: [{ label, stateLabel, state, speed, dist, flank }] */
  updateAIPanel(rows) {
    if (this.aiPanel.hidden) return
    this.aiList.replaceChildren()
    if (!rows.length) {
      this.aiList.appendChild(h('li', 'gu-ai-empty', 'Aún no hay enemigos en escena'))
      return
    }
    rows.forEach((r) => {
      const li = h('li', `gu-ai-row is-${r.state.toLowerCase()}`)
      const name = h('span', 'gu-ai-name', r.label)
      const st = h('span', 'gu-ai-state', r.stateLabel)
      const meta = h('span', 'gu-ai-meta', `${Math.round(r.dist)} m · ${r.speed.toFixed(1)} m/s`)
      li.append(name, st, meta)
      this.aiList.appendChild(li)
    })
  }

  /** Registro de lo que hace la IA (alarmas, flanqueos…). */
  aiEvent(text, tone = 'info') {
    const item = h('li', `gu-ai-event is-${tone}`, text)
    this.aiFeed.prepend(item)
    while (this.aiFeed.children.length > 5) this.aiFeed.lastChild.remove()
    // Los eventos importantes también salen como aviso aunque el panel esté cerrado
    if (tone === 'warn' && this.aiPanel.hidden) {
      this.toast({ icon: '📢', text, tone: 'warn', duration: 2600 })
    }
  }

  // ── Avisos ──────────────────────────────────────────────
  toast({ icon = '', text = '', tone = 'info', duration = 2200 } = {}) {
    const el = h('div', `gu-panel gu-toast gu-toast--${tone}`)
    if (icon) el.appendChild(h('span', 'gu-toast-icon', icon, { 'aria-hidden': 'true' }))
    el.appendChild(h('span', null, text))
    this.toasts.appendChild(el)

    // Máximo 3 avisos a la vez
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove()

    setTimeout(() => {
      el.classList.add('is-leaving')
      setTimeout(() => el.remove(), 260)
    }, duration)
  }

  // ── Subtítulos de la narradora ──────────────────────────
  /**
   * Muestra la frase de la narradora abajo, sobre cualquier tarjeta. text=null la quita.
   * Vive fuera de .gu-root para quedar por encima de las tarjetas (z-index mayor).
   */
  subtitle(text, speaker = '', duration = 4000) {
    clearTimeout(this._subTimer)
    if (!text) {
      this.subtitleEl?.classList.remove('is-visible')
      return
    }
    if (!this.subtitleEl) {
      this.subtitleEl = h('div', 'gu-subtitle', null, { role: 'status', 'aria-live': 'polite' })
      this.subtitleSpeaker = h('span', 'gu-subtitle-speaker')
      this.subtitleText = h('span', 'gu-subtitle-text')
      this.subtitleEl.append(this.subtitleSpeaker, this.subtitleText)
      document.body.appendChild(this.subtitleEl)
    }
    this.subtitleSpeaker.textContent = speaker
    this.subtitleText.textContent = text
    this.subtitleEl.classList.add('is-visible')
    // Con una tarjeta abierta se pega al borde inferior para no tapar su contenido.
    // Se evalúa en el siguiente tick porque a veces la frase se dice antes de crear la tarjeta.
    setTimeout(() => this.subtitleEl?.classList.toggle('is-over-card', this.hasCard), 0)
    this._subTimer = setTimeout(() => this.subtitleEl?.classList.remove('is-visible'), duration)
  }

  // ── Tarjetas ────────────────────────────────────────────
  /**
   * Muestra una tarjeta modal centrada.
   * @param {object} o
   * @param {string} [o.kicker] texto pequeño superior
   * @param {string} o.title
   * @param {string} [o.icon]
   * @param {string[]} [o.paragraphs] párrafos del cuerpo
   * @param {string} [o.text] cuerpo en un solo bloque (respeta saltos de línea)
   * @param {boolean} [o.controls] mostrar la guía de controles
   * @param {Array<[string,string]>} [o.stats] filas etiqueta/valor
   * @param {Array<{label:string,onClick:Function,variant?:string}>} o.actions
   * @param {'default'|'danger'|'success'} [o.variant]
   */
  card({ kicker, title, icon, paragraphs, text, controls = false, stats, actions = [], variant = 'default' } = {}) {
    this.closeCard()

    const backdrop = h('div', 'gu-card-backdrop')
    const card = h('div', `gu-card${variant !== 'default' ? ` gu-card--${variant}` : ''}`, null, {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'gu-card-title',
    })

    if (icon) card.appendChild(h('div', 'gu-card-icon', icon, { 'aria-hidden': 'true' }))
    if (kicker) card.appendChild(h('div', 'gu-kicker', kicker))
    card.appendChild(h('h2', 'gu-card-title', title || '', { id: 'gu-card-title' }))

    if (paragraphs?.length) {
      const body = h('div', 'gu-card-body')
      paragraphs.forEach((p) => body.appendChild(h('p', null, p)))
      card.appendChild(body)
    } else if (text) {
      card.appendChild(h('div', 'gu-card-body gu-card-body--pre', text))
    }

    if (controls) {
      const list = h('ul', 'gu-controls')
      CONTROLS.forEach(({ keys, label }) => {
        const li = h('li')
        const k = h('span', 'gu-keys')
        keys.forEach((key) => k.appendChild(h('kbd', 'gu-key', key)))
        li.append(k, h('span', null, label))
        list.appendChild(li)
      })
      card.appendChild(list)
    }

    if (stats?.length) {
      const list = h('ul', 'gu-stats')
      stats.forEach(([label, value]) => {
        const li = h('li')
        li.append(h('span', null, label), h('strong', null, String(value)))
        list.appendChild(li)
      })
      card.appendChild(list)
    }

    if (actions.length) {
      const bar = h('div', 'gu-card-actions')
      actions.forEach((a, i) => {
        const btn = h('button', `gu-btn${a.variant ? ` gu-btn--${a.variant}` : ''}`, a.label)
        btn.type = 'button'
        btn.addEventListener('click', () => {
          if (a.keepOpen !== true) this.closeCard()
          a.onClick?.()
        })
        bar.appendChild(btn)
        if (i === 0) this._focusTarget = btn
      })
      card.appendChild(bar)
    }

    backdrop.appendChild(card)
    document.body.appendChild(backdrop)
    this.cardBackdrop = backdrop
    this._focusTarget?.focus({ preventScroll: true })
    this._focusTarget = null
    return backdrop
  }

  closeCard() {
    if (this.cardBackdrop) {
      this.cardBackdrop.remove()
      this.cardBackdrop = null
    }
  }

  get hasCard() {
    return !!this.cardBackdrop
  }

  destroy() {
    this.closeCard()
    clearTimeout(this._subTimer)
    this.subtitleEl?.remove()
    this.root?.remove()
  }
}
