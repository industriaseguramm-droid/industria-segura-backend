const router = require('express').Router();
const ctrl = require('../controllers/clientes.controller');
const { verificarToken, soloInterno } = require('../middleware/auth');

router.get('/',     verificarToken, soloInterno, ctrl.listar);
router.post('/',    verificarToken, soloInterno, ctrl.crear);
router.get('/:id',  verificarToken, soloInterno, ctrl.obtener);
router.put('/:id',  verificarToken, soloInterno, ctrl.actualizar);
router.delete('/:id', verificarToken, soloInterno, ctrl.eliminar);

module.exports = router;