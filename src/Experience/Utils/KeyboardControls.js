// Experience/Utils/KeyboardControls.js
import EventEmitter from './EventEmitter.js'

export default class KeyboardControls extends EventEmitter {
    constructor() {
        super()

        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            space: false,
            shift: false
        }

        this.setListeners()
    }

    setListeners() {
        window.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowUp') this.keys.up = true
            if (event.key === 'ArrowDown') this.keys.down = true
            if (event.key === 'ArrowLeft') this.keys.left = true
            if (event.key === 'ArrowRight') this.keys.right = true
            if (event.code === 'Space') this.keys.space = true
            if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.keys.shift = true
            this.trigger('change', this.keys)
        })

        window.addEventListener('keyup', (event) => {
            if (event.key === 'ArrowUp') this.keys.up = false
            if (event.key === 'ArrowDown') this.keys.down = false
            if (event.key === 'ArrowLeft') this.keys.left = false
            if (event.key === 'ArrowRight') this.keys.right = false
            if (event.code === 'Space') this.keys.space = false
            if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.keys.shift = false
            this.trigger('change', this.keys)
        })
    }

    getState() {
        return this.keys
    }
}
