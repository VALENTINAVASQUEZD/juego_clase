const { Pool } = require('pg')

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE || 'game_db',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
})

// GET /api/blocks?level=1
exports.getBlocks = async (req, res) => {
    try {
        const level = parseInt(req.query.level) || 1

        const result = await pool.query(
            'SELECT name, x, y, z, level, role FROM blocks WHERE level = $1',
            [level]
        )

        res.json(result.rows)
    } catch (error) {
        console.error('Error al obtener bloques:', error)
        res.status(500).json({ message: 'Error al obtener bloques', error: error.message })
    }
}

// POST /api/blocks
exports.addBlock = async (req, res) => {
    try {
        const { name, x, y, z, level, role } = req.body

        const result = await pool.query(
            `INSERT INTO blocks (name, x, y, z, level, role)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [name, x, y, z, level || 1, role || 'default']
        )

        res.status(201).json({ message: 'Bloque guardado', block: result.rows[0] })
    } catch (error) {
        console.error('Error al agregar bloque:', error)
        res.status(500).json({ message: 'Error al agregar bloque', error: error.message })
    }
}

// POST /api/blocks/batch  — carga masiva desde JSON (Blender)
exports.addMultipleBlocks = async (req, res) => {
    const blocks = req.body

    if (!Array.isArray(blocks) || blocks.length === 0) {
        return res.status(400).json({ message: 'Se esperaba un array de bloques' })
    }

    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        for (const block of blocks) {
            await client.query(
                `INSERT INTO blocks (name, x, y, z, level, role)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    block.name || null,
                    block.x || 0,
                    block.y || 0,
                    block.z || 0,
                    block.level || 1,
                    block.role || 'default'
                ]
            )
        }

        await client.query('COMMIT')
        res.status(201).json({ message: 'Bloques guardados', count: blocks.length })
    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Error al insertar bloques:', error)
        res.status(500).json({ message: 'Error al insertar bloques', error: error.message })
    } finally {
        client.release()
    }
}