const router = require('express').Router();
const { generarResumenWord } = require('../controllers/word.controller');
const { verificarToken } = require('../middleware/auth');

// GET /api/expedientes/:id/generar-resumen
router.get('/:id/generar-resumen', verificarToken, generarResumenWord);

module.exports = router;
