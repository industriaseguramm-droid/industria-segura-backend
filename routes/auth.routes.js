const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

router.post('/login', ctrl.login);
router.get('/me', verificarToken, ctrl.miPerfil);
router.post('/cambiar-password', verificarToken, ctrl.cambiarPassword);
router.post('/crear-usuario', verificarToken, soloAdmin, ctrl.crearUsuario);
router.get('/usuarios', verificarToken, soloAdmin, ctrl.listarUsuarios);
router.put('/usuarios/:id/toggle', verificarToken, soloAdmin, ctrl.toggleUsuario);

// Endpoint temporal para inicializar admin
router.post('/init-admin', async (req, res) => {
  try {
    const hash = await bcrypt.hash('Segura2025', 10);
    
    await supabase.from('usuarios').delete().eq('email', 'abel@industriasegura.mx');
    
    const { data, error } = await supabase
      .from('usuarios')
      .insert({
        nombre: 'Abel Morales',
        email: 'abel@industriasegura.mx',
        password_hash: hash,
        rol: 'admin',
        activo: true
      })
      .select('id, email, rol')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    
    res.json({ mensaje: 'Admin creado correctamente', usuario: data, hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
