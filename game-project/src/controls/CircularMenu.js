import gsap from 'gsap'

export default class CircularMenu {
  constructor({ container, vrIntegration, onAudioToggle, onWalkMode, onFullscreen, onCancelGame }) {
    this.container = container
    this.vrIntegration = vrIntegration
    this.isOpen = false
    this.actionButtons = []

    const baseStyle = `
      position: fixed; width: 48px; height: 48px; border-radius: 50%;
      background: rgba(0, 255, 247, 0.12); color: #00fff7; font-size: 20px;
      border: 1px solid rgba(0, 255, 247, 0.3); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 10px #00fff7; backdrop-filter: blur(4px);
      z-index: 9999; transition: all 0.3s ease;
    `

    // Botón principal
    this.toggleButton = document.createElement('button')
    this.toggleButton.innerText = '⚙️'
    this.toggleButton.title = 'Mostrar menú'
    this.toggleButton.setAttribute('aria-label', 'Mostrar menú')
    this.toggleButton.style.cssText = baseStyle + 'top: 80px; right: 20px;'
    container.appendChild(this.toggleButton)
    this.toggleButton.style.display = 'none'
    this.toggleButton.addEventListener('click', () => this.toggleMenu())

    const actions = [
      { icon: '🔊', title: 'Audio', onClick: onAudioToggle },
      { icon: '🚶', title: 'Modo Caminata', onClick: onWalkMode },
      { icon: '🖥️', title: 'Pantalla Completa', onClick: onFullscreen },
      { icon: '🥽', title: 'Modo VR', onClick: () => this.vrIntegration.toggleVR() },
      { icon: '👨‍💻', title: 'Acerca de', onClick: () => this.showAboutModal() },
      { icon: '❌', title: 'Cancelar Juego', onClick: onCancelGame }
    ]

    actions.forEach((action, index) => {
      const btn = document.createElement('button')
      btn.innerText = action.icon
      btn.title = action.title
      btn.setAttribute('aria-label', action.title)
      Object.assign(btn.style, {
        position: 'fixed', width: '48px', height: '48px', borderRadius: '50%',
        background: 'rgba(0, 255, 247, 0.12)', color: '#00fff7', fontSize: '20px',
        border: '1px solid rgba(0, 255, 247, 0.3)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 10px #00fff7', backdropFilter: 'blur(4px)',
        zIndex: 9999, top: `${140 + index * 60}px`, right: '20px',
        opacity: '0', pointerEvents: 'none'
      })
      btn.addEventListener('click', () => { action.onClick(); this.toggleMenu() })
      this.container.appendChild(btn)
      this.actionButtons.push(btn)
    })

    // Estilos base HUD
    const hudBase = {
      position: 'fixed', fontSize: '15px', fontWeight: 'bold',
      background: 'rgba(0,0,0,0.65)', color: 'white',
      padding: '6px 14px', borderRadius: '8px', zIndex: '9999',
      fontFamily: 'monospace', pointerEvents: 'none',
      border: '1px solid rgba(0,255,247,0.2)'
    }

    // HUD Tiempo
    this.timer = document.createElement('div')
    this.timer.id = 'hud-timer'
    this.timer.setAttribute('aria-label', 'Tiempo de juego')
    this.timer.innerText = '⏱ 0s'
    Object.assign(this.timer.style, { ...hudBase, top: '16px', left: '70px' })
    document.body.appendChild(this.timer)

    // HUD Nivel actual (centrado arriba) — Actividad 3
    this.levelLabel = document.createElement('div')
    this.levelLabel.id = 'hud-level'
    this.levelLabel.setAttribute('aria-label', 'Nivel actual')
    this.levelLabel.innerText = '🗺️ Nivel: 1 / 5'
    Object.assign(this.levelLabel.style, {
      ...hudBase,
      top: '16px', left: '50%', transform: 'translateX(-50%)',
      fontSize: '16px', color: '#00fff7',
      textShadow: '0 0 8px #00fff7',
      border: '1px solid rgba(0,255,247,0.4)',
      transition: 'all 0.3s ease'
    })
    document.body.appendChild(this.levelLabel)

    // HUD Puntos
    this.status = document.createElement('div')
    this.status.id = 'hud-points'
    this.status.setAttribute('aria-label', 'Puntos acumulados')
    this.status.innerText = '🎖️ Puntos: 0'
    Object.assign(this.status.style, { ...hudBase, top: '16px', right: '20px' })
    document.body.appendChild(this.status)

    // HUD Jugadores
    this.playersLabel = document.createElement('div')
    this.playersLabel.id = 'hud-players'
    this.playersLabel.setAttribute('aria-label', 'Jugadores conectados')
    this.playersLabel.innerText = '👥 Jugadores: 1'
    Object.assign(this.playersLabel.style, { ...hudBase, top: '16px', left: '210px' })
    document.body.appendChild(this.playersLabel)
  }

  showAboutModal() {
    if (this.aboutContainer) return
    this.aboutContainer = document.createElement('div')
    Object.assign(this.aboutContainer.style, {
      position: 'fixed', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0, 0, 0, 0.95)', padding: '20px',
      borderRadius: '12px', color: '#fff', zIndex: '10000',
      textAlign: 'center', fontFamily: 'sans-serif',
      maxWidth: '300px', boxShadow: '0 0 20px #00fff7'
    })
    this.aboutContainer.innerHTML = `
      <h2 style="margin-bottom:10px;">👨‍💻 Desarrollador</h2>
      <p>Gustavo Sánchez Rodríguez</p>
      <p style="font-size:14px;">Universidad Cooperativa de Colombia</p>
      <p style="font-size:13px;margin-top:10px;">Proyecto interactivo educativo con Three.js</p>
      <button style="margin-top:12px;padding:6px 14px;font-size:14px;background:#00fff7;color:black;border:none;border-radius:6px;cursor:pointer;">Cerrar</button>
    `
    this.aboutContainer.querySelector('button').onclick = () => {
      this.aboutContainer.remove(); this.aboutContainer = null
    }
    document.body.appendChild(this.aboutContainer)
  }

  toggleMenu() {
    this.isOpen = !this.isOpen
    this.actionButtons.forEach((btn, index) => {
      const delay = index * 0.05
      if (this.isOpen) {
        gsap.to(btn, { opacity: 1, y: 0, pointerEvents: 'auto', delay, duration: 0.3, ease: 'power2.out' })
      } else {
        gsap.to(btn, { opacity: 0, y: -10, pointerEvents: 'none', delay, duration: 0.2, ease: 'power2.in' })
      }
    })
  }

  setStatus(text) { if (this.status) this.status.innerText = text }

  setTimer(seconds) { if (this.timer) this.timer.innerText = `⏱ ${seconds}s` }

  // Nuevo método para actualizar el nivel en el HUD
  setLevel(current, total = 5) {
    if (!this.levelLabel) return
    this.levelLabel.innerText = `🗺️ Nivel: ${current} / ${total}`
    // Animación de destello al cambiar de nivel
    this.levelLabel.style.color = '#ffff00'
    this.levelLabel.style.transform = 'translateX(-50%) scale(1.15)'
    setTimeout(() => {
      if (this.levelLabel) {
        this.levelLabel.style.color = '#00fff7'
        this.levelLabel.style.transform = 'translateX(-50%) scale(1)'
      }
    }, 700)
  }

  setPlayerCount(count) {
    if (this.playersLabel) this.playersLabel.innerText = `👥 Jugadores: ${count}`
  }

  destroy() {
    this.toggleButton?.remove()
    this.actionButtons?.forEach(btn => btn.remove())
    this.timer?.remove()
    this.status?.remove()
    this.levelLabel?.remove()
    this.playersLabel?.remove()
  }
}