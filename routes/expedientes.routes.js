const router = require('express').Router();
const ctrl = require('../controllers/expedientes.controller');
const { verificarToken, soloInterno } = require('../middleware/auth');

router.get('/',                   verificarToken, soloInterno, ctrl.listar);
router.post('/',                  verificarToken, soloInterno, ctrl.crear);
router.get('/:id',                verificarToken, soloInterno, ctrl.detalle);
router.put('/:id/estatus',        verificarToken, soloInterno, ctrl.cambiarEstatus);
router.post('/:id/observacion',   verificarToken, soloInterno, ctrl.agregarObservacion);

module.exports = router;
