require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const path    = require('path');

const authRoutes   = require('./routes/auth.routes');
const portalRoutes = require('./routes/portal.routes');
const expRoutes    = require('./routes/expedientes.routes');
const arcRoutes    = require('./routes/archivos.routes');
const cliRoutes    = require('./routes/clientes.routes');
const cfgRoutes    = require('./routes/configuracion.routes');
const wordRoutes   = require('./routes/word');
const preciosRoutes = require('./routes/precios.routes');
const app  = express();
const PORT = process.env.PORT || 3001;

const origenesPermitidos = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origenesPermitidos.includes(origin)) return callback(null, true);
    callback(new Error('CORS: Origen no permitido - ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    servicio: 'Industria Segura MM API',
    version: '1.0.0',
    entorno: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth',          authRoutes);
app.use('/api/portal',        portalRoutes);
app.use('/api/expedientes',   expRoutes);
app.use('/api/expedientes',   wordRoutes);
app.use('/api/archivos',      arcRoutes);
app.use('/api/clientes',      cliRoutes);
app.use('/api/configuracion', cfgRoutes);
app.use('/api/precios',       preciosRoutes);
// ESTO (línea nueva)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal-industria-segura-v2 completa.html'));
});

app.get('/panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel-interno-conectado.html'));
});

app.get('/portal/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal-cliente-conectado.html'));
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada: ' + req.method + ' ' + req.originalUrl });
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido' });
  }
  if (err.message && err.message.includes('no permitido')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('Error no manejado:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message
  });
});

app.listen(PORT, () => {
  console.log('Industria Segura MM API corriendo en puerto ' + PORT);
});
