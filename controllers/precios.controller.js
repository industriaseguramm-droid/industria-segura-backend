const supabase = require('../config/supabase');

const obtenerMunicipios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('precios_municipios')
      .select('*')
      .eq('activo', true)
      .order('municipio', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { obtenerMunicipios };
