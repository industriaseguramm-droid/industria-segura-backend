const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');

// ── INTERNOS ─────────────────────────────────────────────────

const listar = async (req, res) => {
  try {
    const { estatus, buscar } = req.query;

    let query = supabase
      .from('expedientes')
      .select(`
        id, folio, estatus, progreso, token_acceso, created_at, updated_at,
        clientes (nombre_comercial, municipio, giro, telefono)
      `)
      .order('created_at', { ascending: false });

    if (estatus && estatus !== 'todos') {
      query = query.eq('estatus', estatus);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    let resultado = data;
    if (buscar) {
      const b = buscar.toLowerCase();
      resultado = data.filter(e =>
        e.clientes?.nombre_comercial?.toLowerCase().includes(b) ||
        e.folio?.toLowerCase().includes(b) ||
        e.clientes?.municipio?.toLowerCase().includes(b)
      );
    }

    const conLinks = resultado.map(e => ({
      ...e,
      link_cliente: `${process.env.FRONTEND_URL}/portal/${e.token_acceso}`
    }));

    res.json(conLinks);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crear = async (req, res) => {
  try {
    const { clienteId, nombreComercial, municipio, giro, contacto, telefono, email } = req.body;

    if (!nombreComercial) {
      return res.status(400).json({ error: 'El nombre comercial es requerido' });
    }

    const año = new Date().getFullYear();
    const { count } = await supabase
      .from('expedientes')
      .select('*', { count: 'exact', head: true });

    const folio = `PC-${año}-${String((count || 0) + 1).padStart(3, '0')}`;
    const tokenAcceso = uuidv4();

    let cId = clienteId;

    if (!cId) {
      const { data: nuevoCliente, error: errCliente } = await supabase
        .from('clientes')
        .insert({
          nombre_comercial: nombreComercial,
          municipio: municipio || null,
          giro: giro || null,
          representante_legal: contacto || null,
          telefono: telefono || null,
          email: email || null
        })
        .select('id')
        .single();

      if (errCliente) {
        return res.status(500).json({ error: errCliente.message });
      }
      cId = nuevoCliente.id;
    }

    const { data, error } = await supabase
      .from('expedientes')
      .insert({
        folio,
        cliente_id: cId,
        token_acceso: tokenAcceso,
        estatus: 'pendiente_cliente',
        progreso: 0,
        datos_json: {},
        creado_por: req.usuario.id
      })
      .select(`
        *,
        clientes (nombre_comercial, municipio, giro)
      `)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({
      ...data,
      link_cliente: `${process.env.FRONTEND_URL}/portal/${tokenAcceso}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const detalle = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('expedientes')
      .select(`
        *,
        clientes (*),
        observaciones (
          id, mensaje, tipo, created_at,
          usuarios (nombre)
        ),
        archivos (
          id, categoria, nombre_original, url_publica,
          tipo_archivo, estatus_campo, es_documento_plan, created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    res.json({
      ...data,
      link_cliente: `${process.env.FRONTEND_URL}/portal/${data.token_acceso}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const cambiarEstatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estatus } = req.body;

    const VALIDOS = [
      'pendiente_cliente', 'en_captura', 'listo_para_revision',
      'en_revision', 'observaciones', 'aprobado', 'completado'
    ];

    if (!VALIDOS.includes(estatus)) {
      return res.status(400).json({ error: 'Estatus inválido' });
    }

    const { data, error } = await supabase
      .from('expedientes')
      .update({ estatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, folio, estatus')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ mensaje: 'Estatus actualizado', expediente: data });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const agregarObservacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { mensaje, tipo = 'comentario' } = req.body;

    if (!mensaje) {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    const TIPOS_VALIDOS = ['comentario', 'solicitud', 'aprobacion'];
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de observación inválido' });
    }

    const { data, error } = await supabase
      .from('observaciones')
      .insert({
        expediente_id: id,
        usuario_id: req.usuario.id,
        mensaje,
        tipo
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (tipo === 'solicitud') {
      await supabase
        .from('expedientes')
        .update({ estatus: 'observaciones', updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    if (tipo === 'aprobacion') {
      await supabase
        .from('expedientes')
        .update({ estatus: 'aprobado', updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ── PORTAL PÚBLICO (por token) ───────────────────────────────

const obtenerPorToken = async (req, res) => {
  try {
    const { token } = req.params;

    const { data, error } = await supabase
      .from('expedientes')
      .select(`
        id, folio, estatus, progreso, datos_json,
        clientes (nombre_comercial, municipio, giro),
        observaciones (id, mensaje, tipo, created_at),
        archivos (id, categoria, nombre_original, url_publica, estatus_campo)
      `)
      .eq('token_acceso', token)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Link inválido o expirado' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const guardarDatosPorToken = async (req, res) => {
  try {
    const { token } = req.params;
    const { seccion, campos } = req.body;

    if (!seccion || !campos) {
      return res.status(400).json({ error: 'Se requieren seccion y campos' });
    }

    const { data: exp, error: errExp } = await supabase
      .from('expedientes')
      .select('id, datos_json, estatus, progreso')
      .eq('token_acceso', token)
      .single();

    if (errExp || !exp) {
      return res.status(404).json({ error: 'Link inválido' });
    }

    const datosActuales = exp.datos_json || {};
    const nuevosDatos = {
      ...datosActuales,
      [seccion]: {
        ...(datosActuales[seccion] || {}),
        ...campos
      }
    };

    const progreso = calcularProgreso(nuevosDatos);
    const nuevoEstatus = exp.estatus === 'pendiente_cliente' ? 'en_captura' : exp.estatus;

    const { data, error } = await supabase
      .from('expedientes')
      .update({
        datos_json: nuevosDatos,
        progreso,
        estatus: nuevoEstatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', exp.id)
      .select('id, folio, progreso, estatus')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ mensaje: 'Datos guardados', progreso: data.progreso, estatus: data.estatus });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const finalizarPorToken = async (req, res) => {
  try {
    const { token } = req.params;

    const { data: exp } = await supabase
      .from('expedientes')
      .select('id, progreso')
      .eq('token_acceso', token)
      .single();

    if (!exp) {
      return res.status(404).json({ error: 'Link inválido' });
    }

    await supabase
      .from('expedientes')
      .update({
        estatus: 'listo_para_revision',
        updated_at: new Date().toISOString()
      })
      .eq('id', exp.id);

    res.json({ mensaje: 'Expediente enviado para revisión', progreso: exp.progreso });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

function calcularProgreso(datos) {
  const requeridos = [
    ['generales', 'nombre_comercial'],
    ['generales', 'representante_legal'],
    ['generales', 'domicilio'],
    ['generales', 'municipio'],
    ['generales', 'telefono'],
    ['generales', 'giro'],
    ['generales', 'superficie'],
    ['generales', 'aforo'],
    ['generales', 'trabajadores'],
    ['generales', 'horario'],
    ['operativa', 'actividades'],
    ['operativa', 'areas'],
    ['operativa', 'quimicos'],
    ['operativa', 'instalacion_electrica'],
    ['seguridad', 'responsable_seguridad'],
    ['seguridad', 'telefonos_emergencia'],
    ['documentos', 'ine'],
    ['documentos', 'constancia_fiscal']
  ];

  let respondidos = 0;
  for (const [seccion, campo] of requeridos) {
    const valor = datos?.[seccion]?.[campo];
    if (valor && (valor.valor || valor.estatus)) respondidos++;
  }

  return Math.min(100, Math.round((respondidos / requeridos.length) * 100));
}

module.exports = {
  listar, crear, detalle, cambiarEstatus, agregarObservacion,
  obtenerPorToken, guardarDatosPorToken, finalizarPorToken
};
