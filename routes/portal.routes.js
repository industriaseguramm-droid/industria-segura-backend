const router = require('express').Router();
const expCtrl = require('../controllers/expedientes.controller');
const arcCtrl = require('../controllers/archivos.controller');
const { uploadArchivo } = require('../middleware/multer');

router.get('/:token',           expCtrl.obtenerPorToken);
router.put('/:token/datos',     expCtrl.guardarDatosPorToken);
router.put('/:token/finalizar', expCtrl.finalizarPorToken);
router.post('/:token/archivo',  uploadArchivo.single('archivo'), arcCtrl.subirPorToken);

module.exports = router;
