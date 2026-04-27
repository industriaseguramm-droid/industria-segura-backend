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

module.exports = { generarResumenWord };
