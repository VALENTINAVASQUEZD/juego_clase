const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')

// POST /api/auth/register  → crear cuenta
router.post('/register', authController.register)

// POST /api/auth/login     → iniciar sesión
router.post('/login', authController.login)

// POST /api/auth/scores    → guardar puntuación (requiere token)
router.post('/scores', authController.requireAuth, authController.saveScore)

// GET  /api/auth/scores    → obtener puntuaciones del usuario autenticado
router.get('/scores', authController.requireAuth, authController.getMyScores)

// GET  /api/auth/ranking   → ranking global (público)
router.get('/ranking', authController.getRanking)

module.exports = router