const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

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
            if (this.menu && typeof this.menu.setTimer === 'function') {
                this.menu.setTimer(elapsed)
            }
            requestAnimationFrame(update)
        }
        update()
    }

    // Guardar tiempo local como fallback
    saveTimeLocal(seconds) {
        const stored = JSON.parse(localStorage.getItem('bestTimes') || '[]')
        stored.push(seconds)
        stored.sort((a, b) => a - b)
        localStorage.setItem('bestTimes', JSON.stringify(stored.slice(0, 5)))
    }

    // Guardar score en PostgreSQL si el usuario está autenticado
    async saveScore(seconds, levelReached = 1, coinsCollected = 0) {
        // Siempre guardar localmente
        this.saveTimeLocal(seconds)

        // Si hay usuario autenticado, guardar en la base de datos
        const token = window.gameToken
        if (!token) return

        try {
            const res = await fetch(`${API}/api/auth/scores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    time_seconds: seconds,
                    level_reached: levelReached,
                    coins_collected: coinsCollected
                })
            })

            if (res.ok) {
                console.log('✅ Score guardado en la base de datos')
            } else {
                console.warn('⚠️ No se pudo guardar el score en el servidor')
            }
        } catch (err) {
            console.warn('⚠️ Error al guardar score:', err.message)
        }
    }

    getBestTimes() {
        return JSON.parse(localStorage.getItem('bestTimes') || '[]')
    }

    async showEndGameModal(currentTime) {
        // Intentar obtener scores del servidor si hay sesión
        let rankingText = ''
        const token = window.gameToken

        if (token) {
            try {
                const res = await fetch(`${API}/api/auth/scores`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    const top = data.scores.slice(0, 5)
                    rankingText = top.length > 0
                        ? '\n\n🏆 Tus mejores tiempos:\n' + top.map((s, i) => `#${i + 1}: ${s.time_seconds}s (Nivel ${s.level_reached})`).join('\n')
                        : ''
                }
            } catch { /* usar fallback local */ }
        }

        if (!rankingText) {
            const best = this.getBestTimes()
            rankingText = best.length > 0
                ? '\n\n🏆 Mejores tiempos locales:\n' + best.map((t, i) => `#${i + 1}: ${t}s`).join('\n')
                : ''
        }

        const userName = window.gameUser ? ` ¡${window.gameUser.username}!` : '!'

        if (!this.modal || typeof this.modal.show !== 'function') {
            console.warn('⚠️ Modal no disponible')
            return
        }

        this.modal.show({
            icon: '🏁',
            message: `¡Felicidades${userName}\nTerminaste la partida.\n⏱ Tu tiempo: ${currentTime}s${rankingText}`,
            buttons: [
                {
                    text: '🔁 Reintentar',
                    onClick: () => window.experience.resetGameToFirstLevel()
                },
                {
                    text: '❌ Cancelar',
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

    showReplayButton() {
        if (document.getElementById('replay-button')) return

        const btn = document.createElement('button')
        btn.id = 'replay-button'
        btn.innerText = '🎮 Volver a jugar'

        Object.assign(btn.style, {
            position: 'fixed', bottom: '20px', right: '20px',
            padding: '10px 16px', fontSize: '16px',
            background: '#00fff7', color: '#000',
            border: 'none', borderRadius: '8px',
            boxShadow: '0 0 12px #00fff7',
            cursor: 'pointer', zIndex: 9999
        })

        btn.onclick = () => {
            this.hideGameButtons()
            window.experience.resetGame()
        }

        document.body.appendChild(btn)
    }

    hideGameButtons() {
        const replayBtn = document.getElementById('replay-button')
        if (replayBtn) replayBtn.remove()
    }

    destroy() {
        this.finished = true
    }

    handleCancelGame() {
        if (this.finished) return

        this.modal?.show({
            icon: '⚠️',
            message: '¿Deseas cancelar la partida en curso?\nPerderás tu progreso actual.',
            buttons: [
                {
                    text: '❌ Cancelar juego',
                    onClick: () => {
                        this.hideGameButtons()
                        this.modal.hide()
                        window.experience.resetGame()
                    }
                },
                {
                    text: '↩️ Seguir jugando',
                    onClick: () => this.modal.hide()
                }
            ]
        })
    }
}