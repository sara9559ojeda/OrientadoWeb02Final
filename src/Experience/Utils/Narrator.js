import { NARRATION, NARRATOR_NAME } from '../../story.js'

// Voz narradora (Aurora). Reproduce grabaciones con voz neuronal (public/audio/narration/*.mp3,
// generadas con scripts/generate-narration.py a partir de NARRATION), así que suena igual en
// cualquier navegador. Si un audio no carga, cae a la síntesis de voz del navegador
// (speechSynthesis). Cada frase sale también como subtítulo, por si el jugador silencia la voz.
//
// Prioridades:
//   'normal'   → se descarta si Aurora ya está hablando o acaba de terminar (no satura).
//   'high'     → interrumpe una frase normal (inicio de capítulo, avisos clave).
//   'critical' → interrumpe lo que sea (game over, portal listo, final).

const STORAGE_KEY = 'nucleoPerdido.voz'
const NORMAL_COOLDOWN_MS = 7000 // pausa mínima entre frases normales
const MS_PER_CHAR = 62 // lectura de subtítulos y margen de seguridad

const PRIORITY = { normal: 0, high: 1, critical: 2 }

const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/narration/`
const CLIP_VOLUME = 0.95
// Frases con grabación: se precargan al crear el narrador (son ~600 KB en total)
const CLIP_KEYS = [
  'prologue', 'chapter2', 'chapter3', 'chapter4', 'chapter5', 'firstFragment', 'halfway',
  'lastFragment', 'coreComplete', 'spotted', 'gameOver-0', 'gameOver-1', 'gameOver-2',
  'epilogue', 'voiceOn',
]

// Voces que suenan mejor / más naturales (Edge y Chrome en Windows, macOS, Android)
const PREFERRED = /natural|online|neural|google|sabina|helena|laura|paulina|mónica|monica|elena|lucia|lucía|dalia|elvira|female|mujer/i

export default class Narrator {
  constructor({ ui }) {
    this.ui = ui
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    this.supported = !!this.synth && typeof window.SpeechSynthesisUtterance === 'function'
    this.voice = null
    this.enabled = this._loadEnabled()

    this.current = null // { id, priority, timer }
    this.spoken = new Set() // ids con once:true que ya sonaron
    this.lastEndAt = 0
    this._token = 0

    // Grabaciones: key → <audio>. Las que fallan se marcan en `broken` y usan la voz del navegador.
    this.clips = new Map()
    this.broken = new Set()
    this.playing = null
    this._preloadClips()

    if (this.supported) {
      this._pickVoice()
      // Las voces se cargan de forma asíncrona en Chrome/Edge
      this._onVoices = () => this._pickVoice()
      this.synth.addEventListener?.('voiceschanged', this._onVoices)
    }

    // Si la pestaña se oculta, que no siga hablando en segundo plano
    this._onVisibility = () => { if (document.hidden) this.stop() }
    document.addEventListener('visibilitychange', this._onVisibility)
  }

  // ── Ajuste del jugador ─────────────────────────────────────
  _loadEnabled() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off'
    } catch {
      return true
    }
  }

  setEnabled(on) {
    this.enabled = !!on
    try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off') } catch { /* sin almacenamiento */ }
    if (!on) this._cancelSpeech()
  }

  /** Activa o silencia la voz (los subtítulos siguen saliendo). Devuelve el nuevo estado. */
  toggle() {
    this.setEnabled(!this.enabled)
    const text = this.enabled ? 'Voz de Aurora activada' : 'Voz de Aurora silenciada (los subtítulos siguen)'
    this.ui?.toast({ icon: this.enabled ? '🎙️' : '🔇', text, tone: 'info', duration: 2200 })
    if (this.enabled) this.say('voiceOn', { priority: 'critical', force: true })
    return this.enabled
  }

  // ── Elección de voz ────────────────────────────────────────
  _pickVoice() {
    const voices = this.synth.getVoices?.() || []
    const spanish = voices.filter((v) => /^es([-_]|$)/i.test(v.lang))
    if (!spanish.length) {
      this.voice = null // el navegador elegirá por lang = 'es-ES'
      return
    }
    const score = (v) => {
      let s = 0
      if (PREFERRED.test(v.name)) s += 3
      if (/natural|online|neural/i.test(v.name)) s += 2
      if (/^es[-_](mx|us|419)/i.test(v.lang)) s += 1 // acento neutro
      if (v.localService) s += 0.5
      return s
    }
    this.voice = spanish.slice().sort((a, b) => score(b) - score(a))[0]
  }

  // ── Hablar ─────────────────────────────────────────────────
  /**
   * Aurora dice una frase de la historia.
   * @param {string} id clave de NARRATION
   * @param {object} [o]
   * @param {'normal'|'high'|'critical'} [o.priority]
   * @param {boolean} [o.once] solo una vez por partida
   * @param {string} [o.text] texto propio (en lugar del de NARRATION)
   * @param {boolean} [o.force] ignora el enfriamiento
   * @returns {boolean} true si la frase se dijo
   */
  say(id, { priority = 'normal', once = false, text, force = false } = {}) {
    if (once && this.spoken.has(id)) return false

    // Si NARRATION tiene variantes se elige una; su grabación es `<id>-<n>`
    let line = text ?? NARRATION[id]
    let clipKey = text === undefined ? id : null // con texto propio no hay grabación
    if (Array.isArray(line)) {
      const i = Math.floor(Math.random() * line.length)
      line = line[i]
      if (clipKey) clipKey = `${id}-${i}`
    }
    if (!line) return false

    const now = performance.now()
    if (this.current) {
      if (PRIORITY[priority] <= PRIORITY[this.current.priority] && !force) return false
    } else if (priority === 'normal' && !force && now - this.lastEndAt < NORMAL_COOLDOWN_MS) {
      return false
    }

    if (once) this.spoken.add(id)
    this._begin(id, line, priority, clipKey)
    return true
  }

  // ── Grabaciones ────────────────────────────────────────────
  _preloadClips() {
    if (typeof Audio === 'undefined') return
    CLIP_KEYS.forEach((key) => {
      const clip = new Audio(`${AUDIO_BASE}${key}.mp3`)
      clip.preload = 'auto'
      clip.volume = CLIP_VOLUME
      clip.addEventListener('error', () => this.broken.add(key), { once: true })
      this.clips.set(key, clip)
    })
  }

  /** La grabación de una frase, o null si no existe o no cargó. */
  _clip(key) {
    if (!key || this.broken.has(key)) return null
    return this.clips.get(key) || null
  }

  _begin(id, line, priority, clipKey) {
    this._cancelSpeech()
    const token = ++this._token
    const estimate = Math.max(2800, line.length * MS_PER_CHAR)

    this.current = { id, priority, timer: null }
    this.ui?.subtitle(line, NARRATOR_NAME, estimate + 600)

    const finish = () => {
      if (token !== this._token) return // ya la reemplazó otra frase
      clearTimeout(this.current?.timer)
      this.current = null
      this.playing = null
      this.lastEndAt = performance.now()
    }

    // Respaldo: algunos navegadores no disparan onend; así Aurora nunca se queda "bloqueada"
    const arm = (ms) => {
      clearTimeout(this.current?.timer)
      if (this.current) this.current.timer = setTimeout(finish, ms)
    }
    arm(estimate + 1500)

    if (!this.enabled) return

    // 1) Grabación con voz neuronal
    const clip = this._clip(clipKey)
    if (clip) {
      this.playing = clip
      clip.currentTime = 0
      clip.onended = finish
      clip.onerror = () => {
        this.broken.add(clipKey)
        if (token === this._token) this._speakWithBrowserVoice(line, token, finish)
      }
      const started = clip.play()
      if (started?.then) {
        started.then(() => {
          if (token !== this._token || !Number.isFinite(clip.duration)) return
          // Subtítulo y respaldo ajustados a la duración real de la grabación
          this.ui?.subtitle(line, NARRATOR_NAME, clip.duration * 1000 + 500)
          arm(clip.duration * 1000 + 1500)
        }).catch(() => {
          // Autoplay bloqueado u otro fallo: se intenta con la voz del navegador
          if (token === this._token) this._speakWithBrowserVoice(line, token, finish)
        })
      }
      return
    }

    // 2) Sin grabación: voz del navegador
    this._speakWithBrowserVoice(line, token, finish)
  }

  _speakWithBrowserVoice(line, token, finish) {
    if (!this.supported) return
    // Chrome falla a veces si se habla justo después de cancel()
    setTimeout(() => {
      if (token !== this._token) return
      const u = new window.SpeechSynthesisUtterance(line)
      u.lang = this.voice?.lang || 'es-ES'
      if (this.voice) u.voice = this.voice
      u.rate = 0.95
      u.pitch = 1.05
      u.volume = 1
      u.onend = finish
      u.onerror = finish
      try { this.synth.speak(u) } catch { finish() }
    }, 60)
  }

  _cancelSpeech() {
    clearTimeout(this.current?.timer)
    this._token++
    this.current = null
    if (this.playing) {
      this.playing.onended = null
      this.playing.onerror = null
      this.playing.pause()
      this.playing = null
    }
    try { this.synth?.cancel() } catch { /* nada que cancelar */ }
  }

  /** Calla a Aurora y quita el subtítulo. */
  stop() {
    this._cancelSpeech()
    this.ui?.subtitle(null)
  }

  destroy() {
    this.stop()
    document.removeEventListener('visibilitychange', this._onVisibility)
    if (this._onVoices) this.synth?.removeEventListener?.('voiceschanged', this._onVoices)
  }
}
