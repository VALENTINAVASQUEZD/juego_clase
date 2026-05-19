// backend/scripts/sync_blocks_postgres.js
// Carga los archivos JSON de bloques directamente a PostgreSQL
// Uso: node scripts/sync_blocks_postgres.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE || 'game_db',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
})

// Todos los niveles disponibles
const filesToLoad = [
    'toy_car_blocks1.json',
    'toy_car_blocks2.json',
    'toy_car_blocks3.json',
    'toy_car_blocks4.json',
    'toy_car_blocks5.json',
]

async function syncBlocks() {
    const client = await pool.connect()

    try {
        for (const fileName of filesToLoad) {
            const filePath = path.join(__dirname, '../data', fileName)

            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️  Archivo no encontrado, omitiendo: ${filePath}`)
                continue
            }

            const blocks = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            if (blocks.length === 0) {
                console.warn(`⚠️  ${fileName} está vacío, omitiendo`)
                continue
            }

            console.log(`📦 Cargando ${blocks.length} bloques desde ${fileName}...`)

            await client.query('BEGIN')

            // Eliminar bloques del mismo nivel antes de reinsertar (evita duplicados)
            const level = blocks[0].level
            await client.query('DELETE FROM blocks WHERE level = $1', [level])
            console.log(`🗑️  Bloques anteriores del nivel ${level} eliminados`)

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
            console.log(`✅ ${fileName} cargado correctamente (nivel ${level})`)
        }

        // Resumen final
        const result = await pool.query(
            'SELECT level, COUNT(*) as total, COUNT(*) FILTER (WHERE role = $1) as coins FROM blocks GROUP BY level ORDER BY level',
            ['default']
        )
        console.log('\n📊 Resumen en PostgreSQL:')
        console.log('Nivel | Total bloques | Monedas (default)')
        console.log('------|---------------|------------------')
        result.rows.forEach(row => {
            console.log(`  ${row.level}   |     ${String(row.total).padEnd(9)}   |   ${row.coins}`)
        })

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('❌ Error al sincronizar bloques:', error.message)
    } finally {
        client.release()
        pool.end()
    }
}

syncBlocks()