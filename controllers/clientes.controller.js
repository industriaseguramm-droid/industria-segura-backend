const supabase = require('../config/supabase');

const listar = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select(`
        *,
        expedientes (id, folio, estatus, progreso, created_at)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crear = async (req, res) => {
  try {
    const {
      nombre_comercial, razon_social, rfc, representante_legal,
      domicilio, municipio, giro, telefono, email
    } = req.body;

    if (!nombre_comercial) {
      return res.status(400).json({ error: 'El nombre comercial es requerido' });
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre_comercial,
        razon_social: razon_social || null,
        rfc: rfc || null,
        representante_legal: representante_legal || null,
        domicilio: domicilio || null,
        municipio: municipio || null,
        giro: giro || null,
        telefono: telefono || null,
        email: email || null
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const obtener = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('clientes')
      .select(`
        *,
        expedientes (id, folio, estatus, progreso, token_acceso, created_at, updated_at)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre_comercial, razon_social, rfc, representante_legal,
      domicilio, municipio, giro, telefono, email
    } = req.body;

    const { data, error } = await supabase
      .from('clientes')
      .update({
        nombre_comercial,
        razon_social,
        rfc,
        representante_legal,
        domicilio,
        municipio,
        giro,
        telefono,
        email,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: expedientes } = await supabase
      .from('expedientes')
      .select('id')
      .eq('cliente_id', id);

    if (expedientes && expedientes.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar un cliente con expedientes activos'
      });
    }

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ mensaje: 'Cliente eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, crear, obtener, actualizar, eliminar };
