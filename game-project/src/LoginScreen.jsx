import { useState } from 'react'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export default function LoginScreen({ onLogin }) {
    const [mode, setMode] = useState('login') // 'login' | 'register'
    const [form, setForm] = useState({ username: '', email: '', password: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
        setError('')
    }

    const handleSubmit = async () => {
        setLoading(true)
        setError('')

        const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
        const body = mode === 'login'
            ? { email: form.email, password: form.password }
            : { username: form.username, email: form.email, password: form.password }

        try {
            const res = await fetch(`${API}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.message || 'Error desconocido')
                return
            }

            // Guardar token y datos del usuario en localStorage
            localStorage.setItem('game_token', data.token)
            localStorage.setItem('game_user', JSON.stringify(data.user))

            onLogin(data.user, data.token)
        } catch (err) {
            setError('No se pudo conectar con el servidor')
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSubmit()
    }

    return (
        <div style={styles.overlay}>
            <div style={styles.card}>
                <div style={styles.icon}>🎮</div>
                <h1 style={styles.title}>Laberintos</h1>

                {/* Tabs */}
                <div style={styles.tabs}>
                    <button
                        style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }}
                        onClick={() => { setMode('login'); setError('') }}
                    >
                        Iniciar sesión
                    </button>
                    <button
                        style={{ ...styles.tab, ...(mode === 'register' ? styles.tabActive : {}) }}
                        onClick={() => { setMode('register'); setError('') }}
                    >
                        Registrarse
                    </button>
                </div>

                {/* Formulario */}
                <div style={styles.form}>
                    {mode === 'register' && (
                        <input
                            style={styles.input}
                            type="text"
                            name="username"
                            placeholder="Nombre de usuario"
                            value={form.username}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            maxLength={50}
                        />
                    )}
                    <input
                        style={styles.input}
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={form.email}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                    />
                    <input
                        style={styles.input}
                        type="password"
                        name="password"
                        placeholder="Contraseña"
                        value={form.password}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                    />

                    {error && <p style={styles.error}>{error}</p>}

                    <button
                        style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? 'Cargando...' : mode === 'login' ? '▶️ Entrar' : '✅ Crear cuenta'}
                    </button>
                </div>

                {/* Jugar sin cuenta */}
                <button
                    style={styles.guestBtn}
                    onClick={() => onLogin(null, null)}
                >
                    Jugar sin cuenta
                </button>
            </div>
        </div>
    )
}

const styles = {
    overlay: {
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #0d0d1a 0%, #1a0d2e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        fontFamily: 'monospace'
    },
    card: {
        background: 'rgba(0,0,0,0.8)',
        border: '1px solid rgba(0,255,247,0.3)',
        borderRadius: '16px',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '360px',
        boxShadow: '0 0 40px rgba(0,255,247,0.15)',
        textAlign: 'center'
    },
    icon: {
        fontSize: '48px',
        marginBottom: '8px'
    },
    title: {
        color: '#00fff7',
        fontSize: '24px',
        marginBottom: '24px',
        textShadow: '0 0 10px #00fff7'
    },
    tabs: {
        display: 'flex',
        marginBottom: '20px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid rgba(0,255,247,0.2)'
    },
    tab: {
        flex: 1,
        padding: '10px',
        background: 'transparent',
        color: 'rgba(255,255,255,0.5)',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontFamily: 'monospace',
        transition: 'all 0.2s'
    },
    tabActive: {
        background: 'rgba(0,255,247,0.15)',
        color: '#00fff7',
        fontWeight: 'bold'
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    input: {
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid rgba(0,255,247,0.3)',
        background: 'rgba(255,255,255,0.05)',
        color: '#fff',
        fontSize: '14px',
        fontFamily: 'monospace',
        outline: 'none'
    },
    error: {
        color: '#ff4444',
        fontSize: '13px',
        margin: '0'
    },
    btn: {
        padding: '12px',
        borderRadius: '8px',
        border: 'none',
        background: '#00fff7',
        color: '#000',
        fontWeight: 'bold',
        fontSize: '16px',
        cursor: 'pointer',
        fontFamily: 'monospace',
        transition: 'all 0.2s'
    },
    btnDisabled: {
        opacity: 0.6,
        cursor: 'not-allowed'
    },
    guestBtn: {
        marginTop: '16px',
        background: 'transparent',
        border: 'none',
        color: 'rgba(255,255,255,0.4)',
        cursor: 'pointer',
        fontSize: '13px',
        fontFamily: 'monospace',
        textDecoration: 'underline'
    }
}