const { createClient } = require('@supabase/supabase-js');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, ImageRun, BorderStyle, WidthType, ShadingType
} = require('docx');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fetchImageBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

function seccionTitulo(texto) {
  return new Paragraph({
    spacing: { before: 300, after: 120 },
    children: [
      new TextRun({ text: texto, bold: true, size: 26, color: '1F4E79' }),
    ],
  });
}

function campo(label, valor) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 21 }),
      new TextRun({ text: valor || '—', size: 21 }),
    ],
  });
}

function val(obj, clave) {
  if (!obj || !obj[clave]) return null;
  return obj[clave].valor || null;
}

function imagenConCaption(buffer, caption, extension = 'jpeg') {
  const typeMap = { jpg: 'jpg', jpeg: 'jpg', png: 'png', gif: 'gif', bmp: 'bmp', webp: 'jpg' };
  const type = typeMap[(extension || 'jpg').toLowerCase()] || 'jpg';
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [
        new ImageRun({
          data: buffer,
          transformation: { width: 420, height: 280 },
          type,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: caption, italics: true, size: 18, color: '666666' }),
      ],
    }),
  ];
}

function tablaBrigadistas(brigadistas = []) {
  const celdaHeader = (texto) => new TableCell({
    shading: { fill: '2E75B6' },
    children: [new Paragraph({
      children: [new TextRun({ text: texto, bold: true, size: 20, color: 'FFFFFF' })],
    })],
  });

  const celdaNormal = (texto) => new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: texto || '—', size: 20 })],
    })],
  });

  const header = new TableRow({
    tableHeader: true,
    children: [celdaHeader('Nombre'), celdaHeader('Rol'), celdaHeader('Teléfono')],
  });

  const filas = brigadistas.map((b) => new TableRow({
    children: [celdaNormal(b.nombre), celdaNormal(b.rol), celdaNormal(b.telefono)],
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...filas],
    borders: {
      top:     { style: BorderStyle.SINGLE, size: 1 },
      bottom:  { style: BorderStyle.SINGLE, size: 1 },
      left:    { style: BorderStyle.SINGLE, size: 1 },
      right:   { style: BorderStyle.SINGLE, size: 1 },
      insideH: { style: BorderStyle.SINGLE, size: 1 },
      insideV: { style: BorderStyle.SINGLE, size: 1 },
    },
  });
}

async function generarResumenWord(req, res) {
  try {
    const { id } = req.params;

    const { data: expediente, error: errExp } = await supabase
      .from('expedientes')
      .select('*, clientes(*)')
      .eq('id', id)
      .single();

    if (errExp || !expediente) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    let d = {};
    try {
      d = typeof expediente.datos_json === 'string'
        ? JSON.parse(expediente.datos_json)
        : expediente.datos_json || {};
    } catch { d = {}; }

    const gral       = d.generales  || {};
    const operativa  = d.operativa  || {};
    const seguridad  = d.seguridad  || {};
    const brigadistas = d.brigadistas || [];

    const { data: archivos } = await supabase
      .from('archivos')
      .select('*')
      .eq('expediente_id', id);

    const todosArchivos = archivos || [];
    const tiposDocumento = ['ine', 'constancia_fiscal', 'permiso_uso_suelo',
      'comprobante_domicilio', 'planos', 'bitacora', 'seguro', 'factura'];

    const fotos = todosArchivos.filter(a => !tiposDocumento.includes(a.tipo));
    const docs  = todosArchivos.filter(a =>  tiposDocumento.includes(a.tipo));

    const etiquetaFoto = {
      fachada:           'Fachada del establecimiento',
      acceso:            'Acceso principal',
      extintor:          'Extintor',
      señalizacion:      'Señalización',
      botiquin:          'Botiquín',
      tablero:           'Tablero eléctrico',
      croquis:           'Croquis del establecimiento',
      salida_emergencia: 'Salida de emergencia',
      ruta_evacuacion:   'Ruta de evacuación',
      area_riesgo:       'Área de riesgo',
    };

    const imagenesDescargadas = [];
    for (const foto of fotos) {
      if (!foto.url) continue;
      const ext = (foto.nombre_archivo || 'foto.jpg').split('.').pop();
      const buffer = await fetchImageBuffer(foto.url);
      if (buffer) {
        imagenesDescargadas.push({
          buffer,
          caption: etiquetaFoto[foto.tipo] || foto.nombre_archivo || 'Fotografía',
          extension: ext,
        });
      }
    }

    const children = [];

    // ENCABEZADO
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: 'INDUSTRIA SEGURA MM', bold: true, size: 36, color: '2E75B6' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: 'Consultoría en Seguridad Industrial y Protección Civil', size: 22, color: '444444' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: 'Reg. DPCE-APF-184-2026  |  Tel. 818-077-0841  |  industriaseguramm@gmail.com', size: 18, color: '888888' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({
          text: `Folio: ${expediente.folio || '—'}   |   Estatus: ${(expediente.estatus || '').toUpperCase()}   |   Progreso: ${expediente.progreso || 0}%`,
          size: 22, bold: true, color: '1F4E79',
        })],
      })
    );

    // SECCIÓN 1
    children.push(seccionTitulo('1. DATOS GENERALES DEL ESTABLECIMIENTO'));
    children.push(campo('Nombre comercial',    val(gral, 'nombre_comercial')));
    children.push(campo('Razón social',        val(gral, 'razon_social')));
    children.push(campo('RFC',                 val(gral, 'rfc')));
    children.push(campo('Representante legal', val(gral, 'representante_legal')));
    children.push(campo('Domicilio',           val(gral, 'domicilio')));
    children.push(campo('Municipio',           val(gral, 'municipio')));
    children.push(campo('Código postal',       val(gral, 'codigo_postal')));
    children.push(campo('Teléfo
