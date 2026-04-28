const router = require('express').Router();
const { generarResumenWord, generarActaConstitutiva, generarResponsiva } = require('../controllers/word.controller');
const { verificarToken } = require('../middleware/auth');

router.get('/:id/generar-resumen',    verificarToken, generarResumenWord);
router.get('/:id/generar-acta',       verificarToken, generarActaConstitutiva);
router.get('/:id/generar-responsiva', verificarToken, generarResponsiva);

module.exports = router;
