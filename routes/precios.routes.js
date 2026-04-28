const router = require('express').Router();
const ctrl = require('../controllers/precios.controller');

router.get('/municipios', ctrl.obtenerMunicipios);

module.exports = router;
