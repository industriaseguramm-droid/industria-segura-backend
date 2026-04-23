const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = header.split(' ')[1];
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const soloInterno = (req, res, next) => {
  if (!req.usuario || !['admin', 'colaborador'].includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
};

const soloAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores' });
  }
  next();
};

module.exports = { verificarToken, soloInterno, soloAdmin };