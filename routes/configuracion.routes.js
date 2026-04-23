const router = require('express').Router();
const ctrl = require('../controllers/configuracion.controller');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { uploadLogo } = require('../middleware/multer');

router.get('/',    ctrl.obtener);
router.put('/',    verificarToken, soloAdmin, ctrl.actualizar);
router.post('/logo', verificarToken, soloAdmin, uploadLogo.single('logo'), ctrl.subirLogo);

module.exports = router;