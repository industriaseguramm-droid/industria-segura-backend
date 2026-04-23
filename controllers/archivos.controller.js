const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');

const BUCKET = process.env.STORAGE_BUCKET_EXPEDIENTES || 'expedientes';

const subirPorToken = async (req, res) => {
  try {
    const { token } = req.params;
    const { categoria, estatusCampo = 'subido' } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    if (!categoria) {
      return res.status(400).json({ error: 'La categoría es requerida' });
    }

    const { data: exp, error: errExp } = await supabase
      .from('expedientes')
      .select('id, folio')
      .eq('token_acceso', token)
      .single();

    if (errExp || !exp) {
      return res.status(404).json({ error: 'Link inválido' });
    }

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const nombrePath = `${exp.id}/${categoria}/${uuidv4()}.${ext}`;

    const { error: uploadError } = await supabase
      .storage
      .from(BUCKET)
      .upload(nombrePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      return res.status(500).json({ error: 'Error al subir el archivo: ' + uploadError.message });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(nombrePath);

    const { data: archivo, error: dbError } = await supabase
      .from('archivos')
      .insert({
        expediente_id: exp.id,
        categoria,
        nombre_original: req.file.originalname,
        nombre_storage: nombrePath,
        url_publica: urlData.publicUrl,
        tipo_archivo: req.file.mimetype,
        tamaño_bytes: req.file.size,
        estatus_campo: estatusCampo,
        es_documento_plan: false
      })
      .select()
      .single();

    if (dbError) {
      return res.status(500).json({ error: 'Error al registrar el archivo' });
    }

    res.status(201).json({
      mensaje: 'Archivo subido correctamente',
      archivo: {
        id: archivo.id,
        categoria: archivo.categoria,
        nombre: archivo.nombre_original,
        url: archivo.url_publica,
        tipo: archivo.tipo_archivo
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const subirInterno = async (req, res) => {
  try {
    const { expedienteId } = req.params;
    const { categoria = 'otros', estatusCampo = 'subido', esDocumentoPlan = 'false' } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const { data: exp } = await supabase
      .from('expedientes')
      .select('id, folio')
      .eq('id', expedienteId)
      .single();

    if (!exp) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    const esPlan = esDocumentoPlan === 'true';
    const subcarpeta = esPlan ? 'plan_contingencia' : categoria;
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const nombrePath = `${exp.id}/${subcarpeta}/${uuidv4()}.${ext}`;

    const { error: uploadError } = await supabase
      .storage
      .from(BUCKET)
      .upload(nombrePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(nombrePath);

    const { data: archivo, error: dbError } = await supabase
      .from('archivos')
      .insert({
        expediente_id: exp.id,
        categoria: subcarpeta,
        nombre_original: req.file.originalname,
        nombre_storage: nombrePath,
        url_publica: urlData.publicUrl,
        tipo_archivo: req.file.mimetype,
        tamaño_bytes: req.file.size,
        estatus_campo: estatusCampo,
        es_documento_plan: esPlan,
        subido_por: req.usuario?.id || null
      })
      .select()
      .single();

    if (dbError) {
      return res.status(500).json({ error: dbError.message });
    }

    res.status(201).json({
      mensaje: 'Archivo subido correctamente',
      archivo: {
        id: archivo.id,
        categoria: archivo.categoria,
        nombre: archivo.nombre_original,
        url: archivo.url_publica,
        tipo: archivo.tipo_archivo,
        es_documento_plan: archivo.es_documento_plan
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const listar = async (req, res) => {
  try {
    const { expedienteId } = req.params;
    const { categoria, soloPlanes } = req.query;

    let query = supabase
      .from('archivos')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('created_at', { ascending: true });

    if (categoria) query = query.eq('categoria', categoria);
    if (soloPlanes === 'true') query = query.eq('es_documento_plan', true);

    const { data, error } = await query;

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
    const { archivoId } = req.params;

    const { data: archivo } = await supabase
      .from('archivos')
      .select('nombre_storage')
      .eq('id', archivoId)
      .single();

    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    await supabase.storage.from(BUCKET).remove([archivo.nombre_storage]);

    const { error } = await supabase
      .from('archivos')
      .delete()
      .eq('id', archivoId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ mensaje: 'Archivo eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const marcarFinal = async (req, res) => {
  try {
    const { archivoId } = req.params;

    const { data, error } = await supabase
      .from('archivos')
      .update({ estatus_campo: 'version_final' })
      .eq('id', archivoId)
      .select('id, nombre_original, estatus_campo')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ mensaje: 'Marcado como versión final', archivo: data });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { subirPorToken, subirInterno, listar, eliminar, marcarFinal };