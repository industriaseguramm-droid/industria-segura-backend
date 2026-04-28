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
      new TextRun({ text: label + ': ', bold: true, size: 21 }),
      new TextRun({ text: valor || '-', size: 21 }),
    ],
  });
}

function val(obj, clave) {
  if (!obj || !obj[clave]) return null;
  return obj[clave].valor || null;
}

function imagenConCaption(buffer, caption, extension) {
  var ext = extension || 'jpeg';
  var typeMap = { jpg: 'jpg', jpeg: 'jpg', png: 'png', gif: 'gif', bmp: 'bmp', webp: 'jpg' };
  var type = typeMap[ext.toLowerCase()] || 'jpg';
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [
        new ImageRun({
          data: buffer,
          transformation: { width: 420, height: 280 },
          type: type,
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

function tablaBrigadistas(brigadistas) {
  var lista = brigadistas || [];

  var celdaHeader = function(texto) {
    return new TableCell({
      shading: { fill: '2E75B6' },
      children: [new Paragraph({
        children: [new TextRun({ text: texto, bold: true, size: 20, color: 'FFFFFF' })],
      })],
    });
  };

  var celdaNormal = function(texto) {
    return new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: texto || '-', size: 20 })],
      })],
    });
  };

  var header = new TableRow({
    tableHeader: true,
    children: [celdaHeader('Nombre'), celdaHeader('Rol'), celdaHeader('Telefono')],
  });

  var filas = lista.map(function(b) {
    return new TableRow({
      children: [celdaNormal(b.nombre), celdaNormal(b.rol), celdaNormal(b.telefono)],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header].concat(filas),
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
    var id = req.params.id;

    var expResult = await supabase
      .from('expedientes')
      .select('*, clientes(*)')
      .eq('id', id)
      .single();

    if (expResult.error || !expResult.data) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    var expediente = expResult.data;

    var d = {};
    try {
      d = typeof expediente.datos_json === 'string'
        ? JSON.parse(expediente.datos_json)
        : expediente.datos_json || {};
    } catch(e) { d = {}; }

    var gral       = d.generales  || {};
    var operativa  = d.operativa  || {};
    var seguridad  = d.seguridad  || {};
    var brigadistas = d.brigadistas || [];

    var arcResult = await supabase
      .from('archivos')
      .select('*')
      .eq('expediente_id', id);

    var todosArchivos = arcResult.data || [];

    var tiposDocumento = ['ine', 'constancia_fiscal', 'permiso_uso_suelo',
      'comprobante_domicilio', 'planos', 'bitacora', 'seguro', 'factura'];

    var fotos = todosArchivos.filter(function(a) { return !a.es_documento_plan; });
    var docs  = todosArchivos.filter(function(a) { return  a.es_documento_plan; });

    var etiquetaFoto = {
      fachada:           'Fachada del establecimiento',
      acceso:            'Acceso principal',
      extintor:          'Extintor',
      senalizacion:      'Senalizacion',
      botiquin:          'Botiquin',
      tablero:           'Tablero electrico',
      croquis:           'Croquis del establecimiento',
      salida_emergencia: 'Salida de emergencia',
      ruta_evacuacion:   'Ruta de evacuacion',
      area_riesgo:       'Area de riesgo',
    };

    var imagenesDescargadas = [];
    for (var i = 0; i < fotos.length; i++) {
      var foto = fotos[i];
     var urlFoto = foto.url_publica || foto.url;
      if (!urlFoto) continue;
      var partes = (foto.nombre_archivo || 'foto.jpg').split('.');
      var ext = partes[partes.length - 1];
      var buffer = await fetchImageBuffer(urlFoto);
      if (buffer) {
        imagenesDescargadas.push({
          buffer: buffer,
          caption: etiquetaFoto[foto.categoria] || foto.categoria || foto.nombre_original || 'Fotografia',
          extension: ext,
        });
      }
    }

    var children = [];

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
        children: [new TextRun({ text: 'Consultoria en Seguridad Industrial y Proteccion Civil', size: 22, color: '444444' })],
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
          text: 'Folio: ' + (expediente.folio || '-') + '   |   Estatus: ' + (expediente.estatus || '').toUpperCase() + '   |   Progreso: ' + (expediente.progreso || 0) + '%',
          size: 22, bold: true, color: '1F4E79',
        })],
      })
    );

    // SECCION 1
    children.push(seccionTitulo('1. DATOS GENERALES DEL ESTABLECIMIENTO'));
    children.push(campo('Nombre comercial',    val(gral, 'nombre_comercial')));
    children.push(campo('Razon social',        val(gral, 'razon_social')));
    children.push(campo('RFC',                 val(gral, 'rfc')));
    children.push(campo('Representante legal', val(gral, 'representante_legal')));
    children.push(campo('Domicilio',           val(gral, 'domicilio')));
    children.push(campo('Municipio',           val(gral, 'municipio')));
    children.push(campo('Codigo postal',       val(gral, 'codigo_postal')));
    children.push(campo('Telefono',            val(gral, 'telefono')));
    children.push(campo('Correo electronico',  val(gral, 'email')));
    children.push(campo('Giro / Actividad',    val(gral, 'giro')));
    children.push(campo('Horario de operacion',val(gral, 'horario')));
    children.push(campo('Aforo maximo',        val(gral, 'aforo')));
    children.push(campo('No. de trabajadores', val(gral, 'trabajadores')));
    children.push(campo('Superficie (m2)',      val(gral, 'superficie')));

    // SECCION 2
    children.push(seccionTitulo('2. INFORMACION OPERATIVA'));
    children.push(campo('Actividades que se realizan', val(operativa, 'actividades')));
    children.push(campo('Areas y equipo existente',    val(operativa, 'areas')));
    children.push(campo('Quimicos o sustancias',       val(operativa, 'quimicos')));
    children.push(campo('Instalacion electrica',       val(operativa, 'instalacion_electrica')));

    // SECCION 3
    children.push(seccionTitulo('3. DATOS DE SEGURIDAD'));
    children.push(campo('Responsable de seguridad', val(seguridad, 'responsable_seguridad')));
    children.push(campo('Telefonos de emergencia',  val(seguridad, 'telefonos_emergencia')));

    // SECCION 4
    children.push(seccionTitulo('4. BRIGADA DE EMERGENCIAS'));
    if (brigadistas.length > 0) {
      children.push(tablaBrigadistas(brigadistas));
    } else {
      children.push(new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: 'Sin brigadistas registrados aun.', italics: true, size: 21, color: '888888' })],
      }));
    }

    // SECCION 5
    if (imagenesDescargadas.length > 0) {
      children.push(seccionTitulo('5. EVIDENCIA FOTOGRAFICA'));
      for (var j = 0; j < imagenesDescargadas.length; j++) {
        var img = imagenesDescargadas[j];
        var imgs = imagenConCaption(img.buffer, img.caption, img.extension);
        for (var k = 0; k < imgs.length; k++) {
          children.push(imgs[k]);
        }
      }
    }

    // SECCION 6
    if (docs.length > 0) {
      children.push(seccionTitulo('6. DOCUMENTOS ANEXOS'));
      for (var m = 0; m < docs.length; m++) {
        var doc = docs[m];
        children.push(new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: (m + 1) + '. ' + (doc.nombre_archivo || doc.tipo || 'Documento'), size: 21 })],
        }));
      }
    }

    // PIE
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 500 },
      children: [new TextRun({
        text: 'Documento generado el ' + new Date().toLocaleDateString('es-MX', { dateStyle: 'long' }) + ' - Industria Segura MM',
        italics: true, size: 18, color: 'AAAAAA',
      })],
    }));

    var documento = new Document({
      creator: 'Industria Segura MM',
      title: 'Resumen Expediente ' + (expediente.folio || id),
      sections: [{ children: children }],
    });

    var bufferFinal = await Packer.toBuffer(documento);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Expediente_' + (expediente.folio || id) + '.docx"');
    res.send(bufferFinal);

  } catch (err) {
    console.error('Error generando Word:', err);
    res.status(500).json({ error: 'Error generando el documento', detalle: err.message });
  }
}

// ══════════════════════════════════════════════════
// TABLA DE DIRECTORES DE PROTECCIÓN CIVIL
// ══════════════════════════════════════════════════
var DIRECTORES_PC = {
  'Guadalupe':                { titulo: 'Ing.',       nombre: 'Cesar Fernando Escobedo Lara',       puesto: 'Director de Protección Civil de Guadalupe N.L.',          registro: 'RACE-113/2025' },
  'Monterrey':                { titulo: 'Comandante', nombre: 'Cesar Daniel Betancourt Saldaña',    puesto: 'Director De Protección Civil De La Secretaria De Seguridad Y Protección A La Ciudadania Del Municipio De Monterrey N.L.', registro: 'DCPE-APF-184-2026' },
  'San Nicolás de los Garza': { titulo: 'Ing.',       nombre: 'Jorge Camacho Rincón',              puesto: 'Director de Protección Civil de San Nicolás N.L.',         registro: 'DCPE-APF-184-2026' },
  'Apodaca':                  { titulo: 'Ing.',       nombre: 'Alejandro Tovar Rodriguez',          puesto: 'Director de Protección Civil de Apodaca N.L.',             registro: 'DCPE-APF-184-2026' },
  'Escobedo':                 { titulo: 'Lic.',       nombre: 'Patricia Pérez Tijerina',            puesto: 'Directora de Protección Civil de Gral. Escobedo N.L.',     registro: 'DCPE-APF-184-2026' },
  'Santa Catarina':           { titulo: 'Comandante', nombre: 'Israel Contreras Vásquez',           puesto: 'Director de Protección Civil de Santa Catarina N.L.',      registro: 'DCPE-APF-184-2026' },
  'García':                   { titulo: 'Mtro.',      nombre: 'José Eduardo González Gómez',        puesto: 'Director General de Protección Civil y Gestión Integral de Riesgos de García N.L.', registro: 'DCPE-APF-184-2026' },
  'Zuazua':                   { titulo: 'Lic.',       nombre: 'Perla Itzel Juárez Martínez',        puesto: 'Directora de Protección Civil de Zuazua N.L.',             registro: 'DCPE-APF-184-2026' },
  'Salinas Victoria':         { titulo: 'Comandante', nombre: 'Héctor Román Hernández',             puesto: 'Director de Protección Civil de Salinas Victoria N.L.',    registro: 'DCPE-APF-184-2026' },
  'San Pedro Garza García':   { titulo: 'Lic.',       nombre: 'Gilberto Alonso Almaguer Meléndez',  puesto: 'Director de Protección Civil de San Pedro Garza García N.L.', registro: 'DCPE-APF-184-2026' },
  'Juárez':                   { titulo: 'Mtro.',      nombre: 'Rodrigo Rangel Cano',                puesto: 'Director de Protección Civil de Juárez N.L.',              registro: 'DCPE-APF-184-2026' },
};

function obtenerDirector(municipio) {
  if (!municipio) return { titulo: '', nombre: '_______________', puesto: '_______________', registro: 'DCPE-APF-184-2026' };
  var keys = Object.keys(DIRECTORES_PC);
  for (var i = 0; i < keys.length; i++) {
    if (municipio.toLowerCase().includes(keys[i].toLowerCase()) || keys[i].toLowerCase().includes(municipio.toLowerCase())) {
      return DIRECTORES_PC[keys[i]];
    }
  }
  return { titulo: '', nombre: '_______________', puesto: '_______________', registro: 'DCPE-APF-184-2026' };
}

function obtenerBrigadistasDesdeJSON(datosJson) {
  var d = datosJson || {};
  var brigadas = d.brigadas || {};
  var lista = [];
  var roles = [
    { key: 'presidente', label: 'Presidente / Representante Legal' },
    { key: 'secretario', label: 'Secretario' },
    { key: 'suplente',   label: 'Suplente' },
    { key: 'director',   label: 'Director' },
    { key: 'incendios',  label: 'Brigadista contra incendios' },
    { key: 'evacuacion', label: 'Brigadista de evacuación' },
    { key: 'auxilios',   label: 'Brigadista de primeros auxilios' },
    { key: 'rescate',    label: 'Brigadista de búsqueda y rescate' },
  ];
  roles.forEach(function(r) {
    var nombre = brigadas[r.key + '_nombre'] && brigadas[r.key + '_nombre'].valor;
    if (nombre) lista.push({ nombre: nombre, rol: r.label, telefono: (brigadas[r.key + '_tel'] && brigadas[r.key + '_tel'].valor) || '-' });
  });
  return lista;
}

// ══════════════════════════════════════════════════
// GENERAR ACTA CONSTITUTIVA
// ══════════════════════════════════════════════════
async function generarActaConstitutiva(req, res) {
  try {
    var id = req.params.id;
    var expResult = await supabase.from('expedientes').select('*, clientes(*)').eq('id', id).single();
    if (expResult.error || !expResult.data) return res.status(404).json({ error: 'Expediente no encontrado' });

    var expediente = expResult.data;
    var d = {};
    try { d = typeof expediente.datos_json === 'string' ? JSON.parse(expediente.datos_json) : expediente.datos_json || {}; } catch(e) { d = {}; }

    var gral = d.generales || {};
    var municipio     = (gral.municipio && gral.municipio.valor) || '';
    var nombreEst     = ((gral.nombre_comercial && gral.nombre_comercial.valor) || '_______________').toUpperCase();
    var domicilio     = (gral.domicilio && gral.domicilio.valor) || '_______________';
    var cp            = (gral.codigo_postal && gral.codigo_postal.valor) || '';
    var trabajadores  = (gral.trabajadores && gral.trabajadores.valor) || '___';

    var director = obtenerDirector(municipio);
    var brigadistas = obtenerBrigadistasDesdeJSON(d);
    var totalBrigadistas = parseInt(trabajadores) || brigadistas.length || 0;

    var fecha = new Date();
    var dia   = fecha.getDate();
    var mes   = fecha.toLocaleString('es-MX', { month: 'long' });
    var anio  = fecha.getFullYear();
    var domCompleto = domicilio + (cp ? ', C.P. ' + cp : '') + ', ' + (municipio || '_______________') + ', Nuevo León, México';

    var children = [];

    // TÍTULO
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 300 },
      children: [new TextRun({ text: '\u201cActa Constitutiva de la Unidad Interna de Protección Civil del Establecimiento\u201d', bold: true, size: 28, font: 'Arial' })],
    }));

    // PÁRRAFO INTRO — mezcla normal + itálicas para hora/día/mes
    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 160 },
      children: [
        new TextRun({ text: 'En el municipio de ' + (municipio || '_______________') + ', Nuevo León, siendo las ', size: 22 }),
        new TextRun({ text: '_____', italics: true, size: 22 }),
        new TextRun({ text: ' horas del día ', size: 22 }),
        new TextRun({ text: String(dia), italics: true, size: 22 }),
        new TextRun({ text: ' del mes de ', size: 22 }),
        new TextRun({ text: mes, italics: true, size: 22 }),
        new TextRun({ text: ' de ' + anio + ', reunidos en las instalaciones de:', size: 22 }),
      ],
    }));

    // NOMBRE ESTABLECIMIENTO — negrita, centrado, mayúsculas
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: nombreEst, bold: true, size: 22 })],
    }));

    // DOMICILIO — subrayado
    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 160 },
      children: [
        new TextRun({ text: 'Sita en ' + domCompleto + '. ', underline: {}, size: 22 }),
      ],
    }));

    // PÁRRAFO BRIGADISTAS — nombres en negrita
    var runsBrig = [new TextRun({ text: 'Los ', size: 22 })];
    brigadistas.forEach(function(b, idx) {
      if (idx > 0) runsBrig.push(new TextRun({ text: ', C. ', size: 22 }));
      runsBrig.push(new TextRun({ text: b.nombre, bold: true, size: 22 }));
    });
    if (brigadistas.length === 0) {
      runsBrig.push(new TextRun({ text: '_______________, C. _______________', bold: true, size: 22 }));
    }
    runsBrig.push(new TextRun({ text: ', así como el ', size: 22 }));
    runsBrig.push(new TextRun({ text: director.titulo + ' ' + director.nombre, bold: true, size: 22 }));
    runsBrig.push(new TextRun({ text: ', ' + director.puesto + '; participan también en esta reunión ', size: 22 }));
    runsBrig.push(new TextRun({ text: String(totalBrigadistas), bold: true, size: 22 }));
    runsBrig.push(new TextRun({ text: ' empleados de dicho establecimiento con el objeto de constituir formalmente la Unidad Interna de Protección Civil de este inmueble.', size: 22 }));

    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 }, children: runsBrig }));

    // TEXTO LEGAL
    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'Como consecuencia de los sucesos ocurridos en el año de 1985, el Gobierno Federal decidió instrumentar un sistema que permitiese una respuesta eficaz y eficiente de los diversos sectores de la sociedad ante la presencia de desastres naturales y/o humanos, con el propósito de prevenir sus consecuencias o en su caso mitigarlas, por lo antes expuesto, con fundamento en el decreto por el que se aprueban las bases para el establecimiento del Sistema Nacional de Protección Civil, Diario Oficial de la Federación del 6 de Mayo de 1986. Organización. Órgano Ejecutivo y compromisos de participación. Publicación de la Coordinación de Protección Civil del año de 1987. Decretado por el que se crea el Consejo Nacional de Protección Civil. Diario Oficial de la Federación del 11 de Mayo de 1990 y Programa Nacional de Protección Civil de 1995 - 2000. Diario Oficial de la Federación del 15 de Julio de 1996. Ley de Protección Civil y su Reglamento Operativo para el Estado de Nuevo León del 22 de Enero de 1997. La Unidad Interna de Protección Civil, cuyos objetivos, es la integración y funciones que se indican a continuación.', size: 22 })],
    }));

    // SECCIONES
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children: [new TextRun({ text: '1. Objetivos:', bold: true, size: 24, font: 'Arial' })] }));
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 }, children: [new TextRun({ text: 'Adecuar el Reglamento Interior u Ordenamiento Jurídico correspondiente, para incluir las funciones de Protección Civil en esta Empresa; elaborar, establecer, operar y evaluar permanentemente el Programa Interno de Protección Civil, así como implantar los mecanismos de coordinación con la Empresas y Entidades Públicas y Sociales, en sus Niveles Federal, Estatal y Municipal que conforma el Sistema Nacional de Protección Civil, con el fin de cumplir con los objetivos del mismo, a través de la ejecución del programa, realizando actividades que conduzcan a salvaguardar la integridad física del personal, de las instalaciones de la unidad y su entorno.', size: 22 })] }));

    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [new TextRun({ text: '2. Integración.', bold: true, size: 24, font: 'Arial' })] }));
children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 400 }, children: [new TextRun({ text: 'Organigrama de la unidad interna de Protección Civil de esta Empresa', size: 24, font: 'Arial' })] }));

// Organigrama en dos columnas usando tabla invisible
var orgRoles = [
  { puesto: 'Presidente de la Unidad Interna', brigadista: brigadistas.find(function(b){ return b.rol && b.rol.toLowerCase().includes('presidente'); }) },
  { puesto: 'Secretario Ejecutivo', brigadista: brigadistas.find(function(b){ return b.rol && b.rol.toLowerCase().includes('secretario'); }) },
  { puesto: 'Director de la Unidad Interna', brigadista: brigadistas.find(function(b){ return b.rol && b.rol.toLowerCase().includes('director'); }) },
  { puesto: 'Suplente', brigadista: brigadistas.find(function(b){ return b.rol && b.rol.toLowerCase().includes('suplente'); }) },
  { puesto: 'Brigadista de Búsqueda y Rescate', brigadista: brigadistas.find(function(b){ return b.rol && b.rol.toLowerCase().includes('rescate'); }) },
  { puesto: 'Brigadista de evacuación del Inmueble', brigadista: brigadistas.find(function(b){ return b.rol && b.rol.toLowerCase().includes('evacuaci'); }) },
  { puesto: 'Brigadista de Primeros Auxilios', brigadista: brigadistas.find(function(b){ return b.rol && b.rol.toLowerCase().includes('auxilios'); }) },
  { puesto: 'Brigadista de Combate Contra Incendios', brigadista: brigadistas.find(function(b){ return b.rol && b.rol.toLowerCase().includes('incendio'); }) },
];

var noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
var noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

for (var oi = 0; oi < orgRoles.length; oi += 2) {
  var izq = orgRoles[oi];
  var der = orgRoles[oi + 1];
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: [new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          width: { size: 4680, type: WidthType.DXA },
          shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 200, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: izq.puesto, underline: {}, size: 22 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: izq.brigadista ? izq.brigadista.nombre : '_______________', bold: true, size: 22 })] }),
          ]
        }),
        new TableCell({
          borders: noBorders,
          width: { size: 4680, type: WidthType.DXA },
          shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 200, bottom: 80, left: 120, right: 120 },
          children: der ? [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: der.puesto, underline: {}, size: 22 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: der.brigadista ? der.brigadista.nombre : '_______________', bold: true, size: 22 })] }),
          ] : [new Paragraph({ children: [new TextRun({ text: '' })] })],
        }),
      ]
    })],
  }));
}

// Director de PC al final del organigrama
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 60 }, children: [new TextRun({ text: 'Director de Protección Civil de ' + (municipio || '_______________') + ', Nuevo León', size: 22 })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: director.titulo + ' ' + director.nombre, bold: true, size: 22 })] }));

    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [new TextRun({ text: '3. Funciones:', bold: true, size: 22 })] }));
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children: [new TextRun({ text: 'Corresponde a los integrantes de la Unidad Interna de Protección Civil, llevar a cabo las siguientes funciones:', size: 22 })] }));

    var funciones = [
      'Diseñar y promover la impartición de cursos de capacitación a los integrantes de las Brigadas Internas de Protección Civil.',
      'Elaborar el diagnóstico de riesgos a los que está expuesta la zona donde se ubica el inmueble.',
      'Elaborar planes de emergencia adecuados a los diferentes agentes perturbadores a los que está expuesto el inmueble.',
      'Establecer acciones permanentes de mantenimiento de las diferentes instalaciones del inmueble.',
      'Determinar el equipo de seguridad que debe ser instalado en el inmueble.',
      'Promover la colocación de señalamientos, de acuerdo con los lineamientos establecidos por la Dirección General de Protección Civil.',
      'Aplicar las normas de seguridad que permitan reducir al máximo la incidencia de riesgos del personal y los bienes del inmueble en general.',
      'Realizar simulacros en el inmueble, de acuerdo con los planes de emergencia y procedimientos metodológicos previamente elaborados para cada desastre (dos veces por año).',
      'Evaluar el avance y eficiencia del programa interno de Protección Civil.',
      'Establecer mecanismos de coordinación con las Empresas responsables de la detección, monitoreo y pronóstico de los diferentes agentes perturbadores.',
      'Se deberá tener especial cuidado en el manejo de productos y equipos peligrosos (tanques de gas, combustibles, solventes y otros)',
      'Elaborar y distribuir material de difusión y concientización para el personal que labora en la Empresa. A fin de estar preparados para una contingencia, elaborar un plan de reconstrucción inicial, para restablecer las condiciones normales de operación del inmueble.',
    ];
    funciones.forEach(function(f) {
      children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80 },
        indent: { left: 360 },
        children: [new TextRun({ text: '- ' + f, size: 22 })],
      }));
    });

    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 200, after: 120 }, children: [new TextRun({ text: '4. Esquema Organizacional:', bold: true, size: 22 })] }));
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 }, children: [new TextRun({ text: 'Para que la Unidad Interna de Protección Civil logre los objetivos y desempeñe las funciones antes descritas, contará con la estructura organizacional incluida en la presente acta.', size: 22 })] }));

    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 300 },
      children: [
        new TextRun({ text: 'Siendo las ', size: 22 }),
        new TextRun({ text: '_____', bold: true, size: 22 }),
        new TextRun({ text: ' horas de la misma fecha arriba señalada, queda constituida la presente Acta Constitutiva de la Unidad Interna de Protección Civil de la Empresa antes señalada, firmando de conformidad al margen y al calce, todos los que en ella intervinieron para su legalidad y constancia.', size: 22 }),
      ],
    }));

    // TABLA DE FIRMAS con nombres de brigadistas
    var border1 = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
    var borders1 = { top: border1, bottom: border1, left: border1, right: border1 };

    var headerRow = new TableRow({
      children: [
        new TableCell({ borders: borders1, width: { size: 4320, type: WidthType.DXA }, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'NOMBRE', bold: true, size: 22 })] })] }),
        new TableCell({ borders: borders1, width: { size: 720, type: WidthType.DXA }, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })] }),
        new TableCell({ borders: borders1, width: { size: 4320, type: WidthType.DXA }, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'FIRMA', bold: true, size: 22 })] })] }),
      ]
    });

    var filasFirma = brigadistas.length > 0 ? brigadistas : [{nombre:''},{nombre:''},{nombre:''},{nombre:''},{nombre:''},{nombre:''},{nombre:''},{nombre:''},{nombre:''}];
    var filas = filasFirma.map(function(b) {
      return new TableRow({
        children: [
          new TableCell({ borders: borders1, width: { size: 4320, type: WidthType.DXA }, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: b.nombre || '', size: 22 })] })] }),
          new TableCell({ borders: borders1, width: { size: 720, type: WidthType.DXA }, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })] }),
          new TableCell({ borders: borders1, width: { size: 4320, type: WidthType.DXA }, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })] }),
        ]
      });
    });

    // Encabezados NOMBRE y FIRMA subrayados y centrados
children.push(new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [5400, 3960],
  rows: [
    new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          width: { size: 5400, type: WidthType.DXA },
          shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NOMBRE', bold: true, underline: {}, size: 22 })] })]
        }),
        new TableCell({
          borders: noBorders,
          width: { size: 3960, type: WidthType.DXA },
          shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'FIRMA', bold: true, underline: {}, size: 22 })] })]
        }),
      ]
    }),
  ].concat(filasFirma.map(function(b) {
    return new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          width: { size: 5400, type: WidthType.DXA },
          shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 0, left: 120, right: 120 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } },
              spacing: { after: 160 },
              children: [new TextRun({ text: b.nombre || '', size: 22 })]
            })
          ]
        }),
        new TableCell({
          borders: noBorders,
          width: { size: 3960, type: WidthType.DXA },
          shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 0, left: 120, right: 120 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } },
              spacing: { after: 160 },
              children: [new TextRun({ text: '', size: 22 })]
            })
          ]
        }),
      ]
    });
  }))
}));

    var documento = new Document({
      creator: 'Industria Segura MM',
      title: 'Acta Constitutiva ' + nombreEst,
      styles: {
        default: {
          document: {
            run: { font: 'Arial', size: 24 }
          }
        }
      },
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: children
      }],
    });

    var bufferFinal = await Packer.toBuffer(documento);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Acta_Constitutiva_' + (expediente.folio || id) + '.docx"');
    res.send(bufferFinal);

  } catch (err) {
    console.error('Error generando Acta:', err);
    res.status(500).json({ error: 'Error generando el acta', detalle: err.message });
  }
}

// ══════════════════════════════════════════════════
// GENERAR RESPONSIVA
// ══════════════════════════════════════════════════
async function generarResponsiva(req, res) {
  try {
    var id = req.params.id;
    var expResult = await supabase.from('expedientes').select('*, clientes(*)').eq('id', id).single();
    if (expResult.error || !expResult.data) return res.status(404).json({ error: 'Expediente no encontrado' });

    var expediente = expResult.data;
    var d = {};
    try { d = typeof expediente.datos_json === 'string' ? JSON.parse(expediente.datos_json) : expediente.datos_json || {}; } catch(e) { d = {}; }

    var gral = d.generales || {};
    var municipio     = (gral.municipio && gral.municipio.valor) || '';
    var nombreEst     = ((gral.nombre_comercial && gral.nombre_comercial.valor) || '_______________').toUpperCase();
    var domicilio     = (gral.domicilio && gral.domicilio.valor) || '_______________';
    var cp            = (gral.codigo_postal && gral.codigo_postal.valor) || '';
    var representante = (gral.representante_legal && gral.representante_legal.valor) || '_______________';
    var razonSocial   = ((gral.razon_social && gral.razon_social.valor) || (gral.nombre_comercial && gral.nombre_comercial.valor) || '_______________').toUpperCase();

    var director = obtenerDirector(municipio);

    var fecha = new Date();
    var dia   = fecha.getDate();
    var mes   = fecha.toLocaleString('es-MX', { month: 'long' });
    var anio  = fecha.getFullYear();
    var domCompleto = domicilio + (cp ? ', C.P. ' + cp : '') + ', ' + (municipio || '_______________') + ', N.L.';

    var children = [];

    // FECHA — alineada a la derecha
    children.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 400 },
      children: [new TextRun({ text: (municipio || '_______________') + ', N. L. a ' + dia + ' de ' + mes + ' del ' + anio, size: 22 })],
    }));

    // DESTINATARIO
    children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: director.titulo + ' ' + director.nombre, bold: true, size: 22 })] }));
children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: director.puesto, size: 22 })] }));
children.push(new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: 'Presente. -', size: 22 })] }));

    // CUERPO
    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'Me permito informarle que el Plan de Contingencias del inmueble que se ha desarrollado conforme a lo establecido en el Capitulo VIII, Artículos 45 y 47 de la Ley de Protección Civil para el Estado de Nuevo León, publicada el 22 de Enero de 1997.', size: 22 })],
    }));

    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'Solo la Dirección General puede autorizar modificaciones o cambios al presente documento. La distribución del mismo es para los jefes de departamento del inmueble y siempre deberá de estar disponible como consulta para los integrantes de las brigadas de emergencia y el personal que labora en este inmueble.', size: 22 })],
    }));

    // PÁRRAFO CON NOMBRE EN NEGRITAS
    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 600 },
      children: [
        new TextRun({ text: 'Así mismo hago constar que el inmueble cumple en su totalidad con los aspectos de seguridad, con las medidas de prevención de riesgos y de seguridad requeridas para el adecuado y seguro funcionamiento del establecimiento denominado ', size: 22 }),
        new TextRun({ text: nombreEst, bold: true, size: 22 }),
      ],
    }));

    // FIRMA ABEL — con espacio para firma
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Abel Alejandro Morales Puente', size: 22 })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'No. Reg. ' + director.registro, size: 22 })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Nombre, Firma, No. de Registro', italics: true, size: 22 })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1200 }, children: [new TextRun({ text: 'Asesor de Protección Civil', size: 22 })] }));

    // PÁRRAFO REPRESENTANTE CON NOMBRE Y DIRECCIÓN EN NEGRITAS/SUBRAYADO
    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 600 },
      children: [
        new TextRun({ text: 'En total acuerdo con el contenido del presente Plan de Contingencias y con la responsabilidad de mantener las instalaciones en total apego a las medidas de prevención de riesgos y de seguridad Federales, Estatales y Municipales que aplican al inmueble ', size: 22 }),
        new TextRun({ text: nombreEst, bold: true, size: 22 }),
        new TextRun({ text: ', ubicado en ', size: 22 }),
        new TextRun({ text: domCompleto, underline: {}, size: 22 }),
        new TextRun({ text: '. Autorizo que el Plan de Contingencias sea presentado ante la Dirección Municipal de Protección Civil, para su revisión y registro.', size: 22 }),
      ],
    }));

    // FIRMA REPRESENTANTE — con espacio para firma
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 60 }, children: [new TextRun({ text: representante, size: 22 })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Nombre y Firma', italics: true, size: 22 })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Representante Legal', size: 22 })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: razonSocial, bold: true, size: 22 })] }));

    var documento = new Document({
      creator: 'Industria Segura MM',
      title: 'Responsiva ' + nombreEst,
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: children
      }],
    });

    var bufferFinal = await Packer.toBuffer(documento);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Responsiva_' + (expediente.folio || id) + '.docx"');
    res.send(bufferFinal);

  } catch (err) {
    console.error('Error generando Responsiva:', err);
    res.status(500).json({ error: 'Error generando la responsiva', detalle: err.message });
  }
}

module.exports = { generarResumenWord, generarActaConstitutiva, generarResponsiva };
