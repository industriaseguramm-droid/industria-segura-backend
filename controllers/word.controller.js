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

function parrafo(texto, opciones) {
  var opts = opciones || {};
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : (opts.right ? AlignmentType.RIGHT : AlignmentType.JUSTIFIED),
    spacing: { before: opts.before || 0, after: opts.after || 120 },
    children: [new TextRun({ text: texto || '', bold: opts.bold || false, size: opts.size || 22, color: opts.color || '000000', italics: opts.italics || false })],
  });
}

function lineaFirma(label) {
  return [
    new Paragraph({ spacing: { before: 400, after: 40 }, children: [new TextRun({ text: '_'.repeat(45), size: 22 })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: label, bold: true, size: 20 })] }),
  ];
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
    var municipio      = (gral.municipio && gral.municipio.valor) || '';
    var nombreEst      = (gral.nombre_comercial && gral.nombre_comercial.valor) || '_______________';
    var domicilio      = (gral.domicilio && gral.domicilio.valor) || '_______________';
    var representante  = (gral.representante_legal && gral.representante_legal.valor) || '_______________';
    var trabajadores   = (gral.trabajadores && gral.trabajadores.valor) || '___';

    var director = obtenerDirector(municipio);
    var brigadistas = obtenerBrigadistasDesdeJSON(d);
    var totalBrigadistas = parseInt(trabajadores) || brigadistas.length || 0;

    var fecha = new Date();
    var dia   = fecha.getDate();
    var mes   = fecha.toLocaleString('es-MX', { month: 'long' });
    var anio  = fecha.getFullYear();

    var children = [];

    children.push(parrafo('Acta Constitutiva de la Unidad Interna de Protección Civil del Establecimiento', { bold: true, size: 26, center: true, after: 300 }));

    children.push(parrafo(
      'En el municipio de ' + (municipio || '_______________') + ', Nuevo León, siendo las _____ horas del día ' + dia + ' del mes de ' + mes + ' de ' + anio + ', reunidos en las instalaciones de:',
      { after: 200 }
    ));

    children.push(parrafo(nombreEst, { bold: true, center: true, size: 24, after: 100 }));
    children.push(parrafo('Sita en ' + domicilio + ', ' + (municipio || '_______________') + ', Nuevo León, México.', { after: 200 }));

    // Nombres de brigadistas
    var nombresBrigadistas = brigadistas.map(function(b) { return 'C. ' + b.nombre; }).join(', ');
    if (!nombresBrigadistas) nombresBrigadistas = 'C. _______________, C. _______________';

    children.push(parrafo(
      'Los ' + nombresBrigadistas + ', así como el ' + director.titulo + ' ' + director.nombre + ', ' + director.puesto + '; participan también en esta reunión ' + totalBrigadistas + ' empleados de dicho establecimiento con el objeto de constituir formalmente la Unidad Interna de Protección Civil de este inmueble.',
      { after: 300 }
    ));

    // Texto legal
    var textoLegal = 'Como consecuencia de los sucesos ocurridos en el año de 1985, el Gobierno Federal decidió instrumentar un sistema que permitiese una respuesta eficaz y eficiente de los diversos sectores de la sociedad ante la presencia de desastres naturales y/o humanos, con el propósito de prevenir sus consecuencias o en su caso mitigarlas, por lo antes expuesto, con fundamento en el decreto por el que se aprueban las bases para el establecimiento del Sistema Nacional de Protección Civil, Diario Oficial de la Federación del 6 de Mayo de 1986. Organización. Órgano Ejecutivo y compromisos de participación. Publicación de la Coordinación de Protección Civil del año de 1987. Decretado por el que se crea el Consejo Nacional de Protección Civil. Diario Oficial de la Federación del 11 de Mayo de 1990 y Programa Nacional de Protección Civil de 1995 - 2000. Diario Oficial de la Federación del 15 de Julio de 1996. Ley de Protección Civil y su Reglamento Operativo para el Estado de Nuevo León del 22 de Enero de 1997. La Unidad Interna de Protección Civil, cuyos objetivos, es la integración y funciones que se indican a continuación.';
    children.push(parrafo(textoLegal, { after: 200 }));

    children.push(parrafo('1. Objetivos:', { bold: true, after: 100 }));
    children.push(parrafo('Adecuar el Reglamento Interior u Ordenamiento Jurídico correspondiente, para incluir las funciones de Protección Civil en esta Empresa; elaborar, establecer, operar y evaluar permanentemente el Programa Interno de Protección Civil, así como implantar los mecanismos de coordinación con la Empresas y Entidades Públicas y Sociales, en sus Niveles Federal, Estatal y Municipal que conforma el Sistema Nacional de Protección Civil, con el fin de cumplir con los objetivos del mismo, a través de la ejecución del programa, realizando actividades que conduzcan a salvaguardar la integridad física del personal, de las instalaciones de la unidad y su entorno.', { after: 200 }));

    children.push(parrafo('2. Integración.', { bold: true, after: 100 }));
    children.push(parrafo('Organigrama de la unidad interna de Protección Civil de esta Empresa', { after: 80 }));
    children.push(parrafo('Director de Protección Civil de ' + (municipio || '_______________') + ', Nuevo León', { after: 40 }));
    children.push(parrafo(director.titulo + ' ' + director.nombre, { bold: true, after: 200 }));

    children.push(parrafo('3. Funciones:', { bold: true, after: 100 }));
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
      children.push(new Paragraph({ spacing: { after: 80 }, bullet: { level: 0 }, children: [new TextRun({ text: f, size: 22 })] }));
    });

    children.push(parrafo('4. Esquema Organizacional:', { bold: true, before: 200, after: 100 }));
    children.push(parrafo('Para que la Unidad Interna de Protección Civil logre los objetivos y desempeñe las funciones antes descritas, contará con la estructura organizacional incluida en la presente acta.', { after: 200 }));

    children.push(parrafo(
      'Siendo las _____ horas de la misma fecha arriba señalada, queda constituida la presente Acta Constitutiva de la Unidad Interna de Protección Civil de la Empresa antes señalada, firmando de conformidad al margen y al calce, todos los que en ella intervinieron para su legalidad y constancia.',
      { after: 300 }
    ));

    // Tabla de firmas
    var firmaRows = [];
    var encabezadoFirma = new TableRow({
      children: [
        new TableCell({ shading: { fill: '2E75B6' }, children: [new Paragraph({ children: [new TextRun({ text: 'NOMBRE', bold: true, size: 20, color: 'FFFFFF' })] })] }),
        new TableCell({ shading: { fill: '2E75B6' }, children: [new Paragraph({ children: [new TextRun({ text: '', bold: true, size: 20, color: 'FFFFFF' })] })] }),
        new TableCell({ shading: { fill: '2E75B6' }, children: [new Paragraph({ children: [new TextRun({ text: 'FIRMA', bold: true, size: 20, color: 'FFFFFF' })] })] }),
      ]
    });
    firmaRows.push(encabezadoFirma);

    var filasBrigadistas = brigadistas.length > 0 ? brigadistas : [{ nombre: '' }, { nombre: '' }, { nombre: '' }, { nombre: '' }, { nombre: '' }];
    filasBrigadistas.forEach(function(b) {
      firmaRows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: b.nombre || '', size: 20 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', size: 20 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', size: 20 })] })] }),
        ]
      }));
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: firmaRows,
      borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 }, insideH: { style: BorderStyle.SINGLE, size: 1 }, insideV: { style: BorderStyle.SINGLE, size: 1 } },
    }));

    var documento = new Document({
      creator: 'Industria Segura MM',
      title: 'Acta Constitutiva ' + nombreEst,
      sections: [{ children: children }],
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
    var municipio      = (gral.municipio && gral.municipio.valor) || '';
    var nombreEst      = (gral.nombre_comercial && gral.nombre_comercial.valor) || '_______________';
    var domicilio      = (gral.domicilio && gral.domicilio.valor) || '_______________';
    var cp             = (gral.codigo_postal && gral.codigo_postal.valor) || '';
    var representante  = (gral.representante_legal && gral.representante_legal.valor) || '_______________';
    var razonSocial    = (gral.razon_social && gral.razon_social.valor) || nombreEst;

    var director = obtenerDirector(municipio);

    var fecha = new Date();
    var dia   = fecha.getDate();
    var mes   = fecha.toLocaleString('es-MX', { month: 'long' });
    var anio  = fecha.getFullYear();
    var domCompleto = domicilio + (cp ? ', C.P. ' + cp : '') + ', ' + (municipio || '_______________') + ', N.L.';

    var children = [];

    // Encabezado fecha y destinatario
    children.push(parrafo((municipio || '_______________') + ', N. L. a ' + dia + ' de ' + mes + ' del ' + anio, { right: true, after: 300 }));
    children.push(parrafo(director.titulo + ' ' + director.nombre, { bold: true, after: 60 }));
    children.push(parrafo(director.puesto, { after: 60 }));
    children.push(parrafo('Presente. -', { after: 300 }));

    // Cuerpo
    children.push(parrafo(
      'Me permito informarle que el Plan de Contingencias del inmueble que se ha desarrollado conforme a lo establecido en el Capitulo VIII, Artículos 45 y 47 de la Ley de Protección Civil para el Estado de Nuevo León, publicada el 22 de Enero de 1997.',
      { after: 200 }
    ));

    children.push(parrafo(
      'Solo la Dirección General puede autorizar modificaciones o cambios al presente documento. La distribución del mismo es para los jefes de departamento del inmueble y siempre deberá de estar disponible como consulta para los integrantes de las brigadas de emergencia y el personal que labora en este inmueble.',
      { after: 200 }
    ));

    children.push(parrafo(
      'Así mismo hago constar que el inmueble cumple en su totalidad con los aspectos de seguridad, con las medidas de prevención de riesgos y de seguridad requeridas para el adecuado y seguro funcionamiento del establecimiento denominado ' + nombreEst,
      { after: 400 }
    ));

    // Firma Abel
    children.push(parrafo('Abel Alejandro Morales Puente', { center: true, after: 40 }));
    children.push(parrafo('No. Reg. ' + director.registro, { center: true, after: 40 }));
    children.push(parrafo('Nombre, Firma, No. de Registro', { center: true, italics: true, after: 40 }));
    children.push(parrafo('Asesor de Protección Civil', { center: true, after: 400 }));

    // Texto representante
    children.push(parrafo(
      'En total acuerdo con el contenido del presente Plan de Contingencias y con la responsabilidad de mantener las instalaciones en total apego a las medidas de prevención de riesgos y de seguridad Federales, Estatales y Municipales que aplican al inmueble ' + nombreEst + ', ubicado en ' + domCompleto + '. Autorizo que el Plan de Contingencias sea presentado ante la Dirección Municipal de Protección Civil, para su revisión y registro.',
      { after: 400 }
    ));

    // Firma representante
    children.push(parrafo(representante, { center: true, after: 40 }));
    children.push(parrafo('Nombre y Firma', { center: true, italics: true, after: 40 }));
    children.push(parrafo('Representante Legal', { center: true, after: 40 }));
    children.push(parrafo(razonSocial, { center: true, bold: true, after: 40 }));

    var documento = new Document({
      creator: 'Industria Segura MM',
      title: 'Responsiva ' + nombreEst,
      sections: [{ children: children }],
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
