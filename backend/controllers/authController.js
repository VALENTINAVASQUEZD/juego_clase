const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')

// Conexión a PostgreSQL local
const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE || 'game_db',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
})

const JWT_SECRET = process.env.JWT_SECRET || 'cambiar_esto_en_produccion'

// ─── Middleware: verificar token JWT ─────────────────────────────────────────
exports.requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token requerido' })
    }

    const token = authHeader.split(' ')[1]
    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        req.userId = decoded.userId
        req.username = decoded.username
        next()
    } catch (err) {
        return res.status(401).json({ message: 'Token inválido o expirado' })
    }
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
exports.register = async (req, res) => {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son requeridos' })
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' })
    }

    try {
        const password_hash = await bcrypt.hash(password, 10)

        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username.trim(), email.trim().toLowerCase(), password_hash]
        )

        const user = result.rows[0]
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        res.status(201).json({
            message: 'Usuario creado correctamente',
            token,
            user: { id: user.id, username: user.username, email: user.email }
        })
    } catch (err) {
        if (err.code === '23505') {
            // Violación de unicidad: usuario o email ya existe
            const field = err.detail?.includes('username') ? 'nombre de usuario' : 'email'
            return res.status(409).json({ message: `Ese ${field} ya está en uso` })
        }
        console.error('Error en registro:', err)
        res.status(500).json({ message: 'Error interno del servidor' })
    }
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
exports.login = async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({ message: 'Email y contraseña requeridos' })
    }

    try {
        const result = await pool.query(
            'SELECT id, username, email, password_hash FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        )

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Credenciales incorrectas' })
        }

        const user = result.rows[0]
        const valid = await bcrypt.compare(password, user.password_hash)

        if (!valid) {
            return res.status(401).json({ message: 'Credenciales incorrectas' })
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        res.json({
            message: 'Login exitoso',
            token,
            user: { id: user.id, username: user.username, email: user.email }
        })
    } catch (err) {
        console.error('Error en login:', err)
        res.status(500).json({ message: 'Error interno del servidor' })
    }
}

// ─── POST /api/auth/scores ────────────────────────────────────────────────────
exports.saveScore = async (req, res) => {
    const { time_seconds, level_reached, coins_collected } = req.body

    if (time_seconds === undefined || time_seconds === null) {
        return res.status(400).json({ message: 'time_seconds es requerido' })
    }

    try {
        const result = await pool.query(
            `INSERT INTO scores (user_id, time_seconds, level_reached, coins_collected)
             VALUES ($1, $2, $3, $4)
             RETURNING id, time_seconds, level_reached, coins_collected, played_at`,
            [req.userId, time_seconds, level_reached || 1, coins_collected || 0]
        )

        res.status(201).json({
            message: 'Puntuación guardada',
            score: result.rows[0]
        })
    } catch (err) {
        console.error('Error guardando score:', err)
        res.status(500).json({ message: 'Error interno del servidor' })
    }
}

// ─── GET /api/auth/scores ─────────────────────────────────────────────────────
exports.getMyScores = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, time_seconds, level_reached, coins_collected, played_at
             FROM scores
             WHERE user_id = $1
             ORDER BY played_at DESC
             LIMIT 10`,
            [req.userId]
        )

        res.json({ scores: result.rows })
    } catch (err) {
        console.error('Error obteniendo scores:', err)
        res.status(500).json({ message: 'Error interno del servidor' })
    }
}

// ─── GET /api/auth/ranking ────────────────────────────────────────────────────
exports.getRanking = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT username, best_time, max_level, max_coins, total_games
             FROM ranking
             LIMIT 10`
        )

        res.json({ ranking: result.rows })
    } catch (err) {
        console.error('Error obteniendo ranking:', err)
        res.status(500).json({ message: 'Error interno del servidor' })
    }
}