const supabase = require('../config/supabase');

const DEFAULTS = {
  color_primario: '#D72B2B',
  color_secundario: '#111111',
  nombre_empresa: 'Industria Segura MM',
  mensaje_bienvenida: 'Bienvenido a tu portal de Protección Civil',
  submensaje: 'Captura la información de tu negocio para elaborar tu Plan de Contingencia.',
  logo_url: null,
  whatsapp: '',
  campos_activos: null,
  hero_badge: 'Reg. DPCE-APF-184-2026 · Guadalupe, N.L.',
  hero_titulo: 'PROTEGE TU EMPRESA, EVITA MULTAS Y SANCIONES.',
  hero_subtitulo: 'Consultoría en Seguridad Industrial y Protección Civil',
  hero_descripcion: 'Especialistas en Programas Internos de Protección Civil, capacitación a brigadas, cumplimiento STPS y venta de equipos de emergencia para empresas en Nuevo León.',
  stat_clientes: '+100',
  stat_cursos: '20+',
  stat_cobertura: 'NL',
  contacto_telefono: '818-077-0841',
  contacto_email: 'industriaseguramm@gmail.com',
  contacto_municipio: 'Guadalupe, Nuevo León, México',
  registro: 'Reg. DPCE-APF-184-2026',
  whatsapp_numero: '528180770841',
  instagram_url: 'https://www.instagram.com/industria_seguramm',
  footer_descripcion: 'Consultoría en Seguridad Industrial y Protección Civil. Protege tu patrimonio, cumple la ley, evita multas y sanciones.'
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
    res.json({ ...DEFAULTS, ...data });
  } catch (err) {
    res.json(DEFAULTS);
  }
};

const actualizar = async (req, res) => {
  try {
    const campos = { ...req.body, updated_at: new Date().toISOString() };
    delete campos.id;

    const { data, error } = await supabase
      .from('configuracion')
      .update(campos)
      .eq('id', 1)
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
      .update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq('id', 1);
    res.json({ mensaje: 'Logo actualizado correctamente', url: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { obtener, actualizar, subirLogo };
