const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    console.log('LOGIN INTENTO:', email);

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    console.log('SUPABASE ERROR:', JSON.stringify(error));
    console.log('USUARIO ENCONTRADO:', usuario ? usuario.email : 'NO ENCONTRADO');

    if (error || !usuario) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    if (!usuario.activo) {
      return res.status(401).json({ error: 'Cuenta desactivada' });
    }

    console.log('HASH EN BD:', usuario.password_hash);
    console.log('PASSWORD RECIBIDO:', password);

    const passwordValido = await bcrypt.compare(password, usuario.password_hash);

    console.log('PASSWORD VALIDO:', passwordValido);

    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await supabase
      .from('usuarios')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', usuario.id);

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    });
  } catch (err) {
    console.log('ERROR CATCH:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crearUsuario = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (!['admin', 'colaborador'].includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido. Use admin o colaborador' });
    }

    const { data: existe } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existe) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }

    const hash = await bcrypt.hash(password, 12);

    const { data, error } = await supabase
      .from('usuarios')
      .insert({
        nombre,
        email: email.toLowerCase().trim(),
        password_hash: hash,
        rol,
        activo: true,
        creado_por: req.usuario.id
      })
      .select('id, nombre, email, rol')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ mensaje: 'Usuario creado exitosamente', usuario: data });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const miPerfil = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, ultimo_acceso, created_at')
      .eq('id', req.usuario.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const cambiarPassword = async (req, res) => {
  try {
    const { passwordActual, passwordNuevo } = req.body;

    if (!passwordActual || !passwordNuevo) {
      return res.status(400).json({ error: 'Ambas contraseñas son requeridas' });
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('password_hash')
      .eq('id', req.usuario.id)
      .single();

    const valido = await bcrypt.compare(passwordActual, usuario.password_hash);
    if (!valido) {
      return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    }

    const nuevoHash = await bcrypt.hash(passwordNuevo, 12);

    await supabase
      .from('usuarios')
      .update({ password_hash: nuevoHash, updated_at: new Date().toISOString() })
      .eq('id', req.usuario.id);

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const listarUsuarios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, activo, ultimo_acceso, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const toggleUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('activo')
      .eq('id', id)
      .single();

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { data, error } = await supabase
      .from('usuarios')
      .update({ activo: !usuario.activo })
      .eq('id', id)
      .select('id, nombre, activo')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ mensaje: `Usuario ${data.activo ? 'activado' : 'desactivado'}`, usuario: data });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login, crearUsuario, miPerfil, cambiarPassword, listarUsuarios, toggleUsuario };
