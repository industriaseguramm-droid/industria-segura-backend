const supabase = require('../config/supabase');

const DEFAULTS = {
  color_primario: '#D72B2B',
  color_secundario: '#111111',
  nombre_empresa: 'Industria Segura MM',
  mensaje_bienvenida: 'Bienvenido a tu portal de Protección Civil',
  submensaje: 'Captura la información de tu negocio para elaborar tu Plan de Contingencia.',
  logo_url: null,
  whatsapp: '',
  campos_activos: null
};

const obtener = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      return res.json(DEFAULTS);
    }

    res.json(data);
  } catch (err) {
    res.json(DEFAULTS);
  }
};

const actualizar = async (req, res) => {
  try {
    const {
      color_primario,
      color_secundario,
      nombre_empresa,
      mensaje_bienvenida,
      submensaje,
      whatsapp,
      campos_activos
    } = req.body;

    const { data, error } = await supabase
      .from('configuracion')
      .upsert({
        id: 1,
        color_primario: color_primario || DEFAULTS.color_primario,
        color_secundario: color_secundario || DEFAULTS.color_secundario,
        nombre_empresa: nombre_empresa || DEFAULTS.nombre_empresa,
        mensaje_bienvenida: mensaje_bienvenida || DEFAULTS.mensaje_bienvenida,
        submensaje: submensaje || DEFAULTS.submensaje,
        whatsapp: whatsapp || '',
        campos_activos: campos_activos || null,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ mensaje: 'Configuración guardada correctamente', data });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const subirLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    }

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const nombrePath = `logo/logo-industria-segura.${ext}`;

    await supabase.storage.from('configuracion').remove([nombrePath]);

    const { error: uploadError } = await supabase
      .storage
      .from('configuracion')
      .upload(nombrePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: urlData } = supabase.storage
      .from('configuracion')
      .getPublicUrl(nombrePath);

    await supabase
      .from('configuracion')
      .upsert({ id: 1, logo_url: urlData.publicUrl, updated_at: new Date().toISOString() });

    res.json({ mensaje: 'Logo actualizado correctamente', url: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { obtener, actualizar, subirLogo };
