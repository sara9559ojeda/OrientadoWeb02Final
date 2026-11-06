// src/utils/GameTracker.js

export default class GameTracker {
    constructor({ modal, menu }) {
        this.modal = modal
        this.menu = menu
        this.startTime = null
        this.endTime = null
        this.finished = false
    }

    start() {
        this.startTime = Date.now()
        this._startLoop()
    }

    stop() {
        this.endTime = Date.now()
        this.finished = true
        return this.getElapsedSeconds()
    }

    getElapsedSeconds() {
        if (!this.startTime) return 0
        const end = this.finished ? this.endTime : Date.now()
        return Math.floor((end - this.startTime) / 1000)
    }

    _startLoop() {
        const update = () => {
            if (this.finished) return
            const elapsed = this.getElapsedSeconds()

            //console.log('⏱ Actualizando HUD con segundos:', elapsed)

            if (this.menu && typeof this.menu.setTimer === 'function') {
                this.menu.setTimer(elapsed)
            }

            requestAnimationFrame(update)
        }
        update()
    }

    saveTime(seconds) {
        const stored = JSON.parse(localStorage.getItem('bestTimes') || '[]')
        stored.push(seconds)
        stored.sort((a, b) => a - b)
        localStorage.setItem('bestTimes', JSON.stringify(stored.slice(0, 5)))
    }

    getBestTimes() {
        return JSON.parse(localStorage.getItem('bestTimes') || '[]')
    }

    //Modal de fin de juego
    showEndGameModal(currentTime) {
        const best = this.getBestTimes()
        const ranking = best.map((t, i) => `#${i + 1}: ${t}s`).join('\n')

        if (!this.modal || typeof this.modal.show !== 'function') {
            console.warn('⚠️ No se puede mostrar el modal de fin: modal no definido.')
            return
        }

        this.modal.show({
            icon: '🏁',
            message: `¡Felicidades!\nTerminaste la partida.\n⏱ Tu tiempo: ${currentTime}s\n\n🏆 Mejores tiempos:\n${ranking}`,
            buttons: [
                {
                    text: 'Reintentar',
                    onClick: () => {
                        window.experience.resetGame()
                    }
                },
                {
                    text: 'Cerrar',
                    onClick: () => {
                        this.modal.hide()
                        this.showReplayButton()
                    }
                }

            ]
        })

        const cancelBtn = document.getElementById('cancel-button')
        if (cancelBtn) cancelBtn.remove()

    }

    //iniciar juego
    showReplayButton() {
        if (document.getElementById('replay-button')) return

        const btn = document.createElement('button')
        btn.id = 'replay-button'
        btn.className = 'gu-btn gu-float-br'
        btn.type = 'button'
        btn.innerText = 'Volver a jugar'

        btn.onclick = () => {
            this.hideGameButtons()
            window.experience.resetGame()
        }

        document.body.appendChild(btn)
    }



    hideGameButtons() {
        const replayBtn = document.getElementById('replay-button')
        const cancelBtn = document.getElementById('cancel-button')
        if (replayBtn) replayBtn.remove()
        if (cancelBtn) cancelBtn.remove()
    }


    destroy() {
        this.finished = true
        if (this.timerElement && this.timerElement.remove) {
            this.timerElement.remove()
            this.timerElement = null
        }
    }


}