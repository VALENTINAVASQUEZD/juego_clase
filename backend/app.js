require('dotenv').config()
const express = require('express')
const cors = require('cors')
const blockRoutes = require('./routes/blockRoutes')
const authRoutes = require('./routes/authRoutes')

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.json({
        message: 'API del juego activa (PostgreSQL)',
        routes: [
            'GET  /api/blocks?level=1  - Bloques del mapa por nivel',
            'POST /api/blocks          - Agregar un bloque',
            'POST /api/blocks/batch    - Agregar lote de bloques',
            'POST /api/auth/register   - Registro',
            'POST /api/auth/login      - Login',
            'POST /api/auth/scores     - Guardar puntuacion (token)',
            'GET  /api/auth/scores     - Mis puntuaciones (token)',
            'GET  /api/auth/ranking    - Ranking global'
        ]
    })
})

app.use('/api/blocks', blockRoutes)
app.use('/api/auth', authRoutes)

// Socket.io para multijugador
const http = require('http')
const socketio = require('socket.io')
const server = http.createServer(app)
const io = socketio(server, { cors: { origin: '*' } })

let players = {}

io.on('connection', (socket) => {
    console.log('🟢 Usuario conectado:', socket.id)

    socket.on('new-player', (data) => {
        players[socket.id] = {
            id: socket.id,
            position: data.position || { x: 0, y: 0, z: 0 },
            rotation: data.rotation || 0,
            color: data.color || '#ffffff'
        }
        socket.broadcast.emit('spawn-player', { id: socket.id, ...players[socket.id] })
        socket.emit('players-update', players)
        const others = Object.entries(players)
            .filter(([id]) => id !== socket.id)
            .map(([id, info]) => ({ id, ...info }))
        socket.emit('existing-players', others)
    })

    socket.on('update-position', ({ position, rotation }) => {
        if (players[socket.id]) {
            players[socket.id].position = position
            players[socket.id].rotation = rotation
            socket.broadcast.emit('update-player', { id: socket.id, position, rotation })
        }
    })

    socket.on('disconnect', () => {
        console.log('🔴 Usuario desconectado:', socket.id)
        delete players[socket.id]
        io.emit('remove-player', socket.id)
        io.emit('players-update', players)
    })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT} (PostgreSQL)`))