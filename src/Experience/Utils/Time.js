import EventEmitter from './EventEmitter.js'

export default class Time extends EventEmitter
{
    constructor()
    {
        super()

        // Setup
        this.start = Date.now()
        this.current = this.start
        this.elapsed = 0
        this.delta = 16

        this.frameId = window.requestAnimationFrame(() =>
        {
            this.tick()
        })
    }

    /** Detiene el bucle de animación (al destruir la Experience). */
    destroy()
    {
        this.stopped = true
        window.cancelAnimationFrame(this.frameId)
    }

    tick()
    {
        if(this.stopped) return

        const currentTime = Date.now()
        this.delta = currentTime - this.current
        this.current = currentTime
        this.elapsed = this.current - this.start

        this.trigger('tick')

        if(this.stopped) return

        this.frameId = window.requestAnimationFrame(() =>
        {
            this.tick()
        })
    }
}