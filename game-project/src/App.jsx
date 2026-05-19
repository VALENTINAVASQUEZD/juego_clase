import { useEffect, useRef, useState } from 'react'
import Experience from './Experience/Experience'
import LoginScreen from './LoginScreen'
import './styles/loader.css'

const App = () => {
  const canvasRef = useRef()
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [user, setUser] = useState(null)

  // Al montar, verificar si ya hay sesión guardada
  useEffect(() => {
    const savedToken = localStorage.getItem('game_token')
    const savedUser = localStorage.getItem('game_user')
    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
        setLoggedIn(true)
      } catch {
        localStorage.removeItem('game_token')
        localStorage.removeItem('game_user')
      }
    }
  }, [])

  // Iniciar el juego solo cuando el usuario esté logueado
  useEffect(() => {
    if (!loggedIn || !canvasRef.current) return

    const experience = new Experience(canvasRef.current)

    // Pasar datos del usuario a la experiencia para guardar scores
    if (user) {
      window.gameUser = user
      window.gameToken = localStorage.getItem('game_token')
    }

    const handleProgress = (e) => setProgress(e.detail)
    const handleComplete = () => setLoading(false)

    window.addEventListener('resource-progress', handleProgress)
    window.addEventListener('resource-complete', handleComplete)

    return () => {
      window.removeEventListener('resource-progress', handleProgress)
      window.removeEventListener('resource-complete', handleComplete)
    }
  }, [loggedIn, user])

  const handleLogin = (userData, token) => {
    setUser(userData)
    setLoggedIn(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('game_token')
    localStorage.removeItem('game_user')
    window.gameUser = null
    window.gameToken = null
    setUser(null)
    setLoggedIn(false)
    setLoading(true)
    setProgress(0)
    // Recargar para limpiar la instancia de Experience
    window.location.reload()
  }

  // Mostrar login si no está autenticado
  if (!loggedIn) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <>
      {loading && (
        <div id="loader-overlay">
          <div id="loader-bar" style={{ width: `${progress}%` }}></div>
          <div id="loader-text">Cargando... {progress}%</div>
        </div>
      )}

      {/* HUD: nombre de usuario y botón de logout */}
      {user && !loading && (
        <div style={{
          position: 'fixed', top: '16px', left: '16px',
          background: 'rgba(0,0,0,0.6)',
          color: '#00fff7', padding: '6px 12px',
          borderRadius: '8px', fontFamily: 'monospace',
          fontSize: '14px', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          👤 {user.username}
          <button onClick={handleLogout} style={{
            background: 'transparent', border: '1px solid rgba(0,255,247,0.3)',
            color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
            borderRadius: '4px', padding: '2px 8px', fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            Salir
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="webgl" />
    </>
  )
}

export default App