const router = require('express').Router();
const ctrl = require('../controllers/archivos.controller');
const { verificarToken, soloInterno } = require('../middleware/auth');
const { uploadArchivo } = require('../middleware/multer');

router.post('/subir/:expedienteId', verificarToken, soloInterno, uploadArchivo.single('archivo'), ctrl.subirInterno);
router.get('/:expedienteId',        verificarToken, soloInterno, ctrl.listar);
router.delete('/:archivoId',        verificarToken, soloInterno, ctrl.eliminar);
router.put('/:archivoId/final',     verificarToken, soloInterno, ctrl.marcarFinal);

module.exports = router;