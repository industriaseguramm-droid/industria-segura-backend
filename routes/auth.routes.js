const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { verificarToken, soloAdmin } = require('../middleware/auth');

router.post('/login',              ctrl.login);
router.get('/me',                  verificarToken, ctrl.miPerfil);
router.post('/cambiar-password',   verificarToken, ctrl.cambiarPassword);
router.post('/crear-usuario',      verificarToken, soloAdmin, ctrl.crearUsuario);
router.get('/usuarios',            verificarToken, soloAdmin, ctrl.listarUsuarios);
router.put('/usuarios/:id/toggle', verificarToken, soloAdmin, ctrl.toggleUsuario);

module.exports = router;
