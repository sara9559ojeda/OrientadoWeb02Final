import { Howl, Howler } from 'howler'

export default class Sound {
    constructor(src, options = {}) {
        this.sound = new Howl({
            src: [src],
            ...options
        })

        this._retryCount = 0
        this._maxRetries = 5
    }

    async play() {
        const ctx = Howler.ctx

        if (ctx.state === 'suspended') {
            try {
                await ctx.resume()
                console.log('🔊 AudioContext reanudado desde Sound.js')
            } catch (e) {
                console.warn('⚠️ Audio suspendido. No se pudo reanudar todavía.', e)
                return
            }
        }

        // Solo reproducir si el contexto está activo y no se está reproduciendo ya
        if (ctx.state === 'running') {
            if (!this.sound.playing()) {
                this.sound.play()
                this._retryCount = 0 // reset
            }
        } else {
            if (this._retryCount < this._maxRetries) {
                console.warn('⏸️ AudioContext aún no está activo. Reintento programado.')
                this._retryCount++
                setTimeout(() => {
                    this.play()
                }, 500)
            } else {
                console.warn('🛑 Máximo número de intentos de reproducción alcanzado.')
            }
        }
    }

    stop() {
        this.sound.stop()
        this._retryCount = 0
    }
}
