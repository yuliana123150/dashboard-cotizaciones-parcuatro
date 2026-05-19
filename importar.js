/**
 * Importador de cotizaciones históricas → Supabase
 * Lee todos los PDFs y XLSXs de carpetas de clientes y los inserta.
 */
const PDFParser = require('pdf2json');
const XLSX      = require('xlsx');
const fs        = require('fs');
const path      = require('path');
const https     = require('https');

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────
const SUPABASE_URL = 'rmvlwquwhwkkavzggfwi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtdmx3cXV3aHdra2F2emdnZndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTk0NTgsImV4cCI6MjA5NDc3NTQ1OH0.3bwmnG2cMzJgVBHwE4q_WGfcyLvgYtQrz3xnd_se1kw';

const BASE = 'C:/Users/ypine/OneDrive/Documentos/Clientes';

// Carpetas que NO son clientes
const EXCLUIR = ['DASHBOARD COTIZACIONES', '00 - GENERAL', '.claude'];

// ─── SUPABASE INSERT ──────────────────────────────────────────────────────
function supabaseInsert(rows) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(rows);
    const opts = {
      hostname: SUPABASE_URL,
      path: '/rest/v1/cotizaciones',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(body),
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(true);
        else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── PARSEAR PDF ──────────────────────────────────────────────────────────
function parsePDF(filePath) {
  return new Promise((resolve) => {
    const parser = new PDFParser(null, 1);
    parser.on('pdfParser_dataReady', () => resolve(parser.getRawTextContent()));
    parser.on('pdfParser_dataError', () => resolve(''));
    try { parser.loadPDF(filePath); }
    catch { resolve(''); }
  });
}

// ─── EXTRAER PROVEEDOR DEL TEXTO ──────────────────────────────────────────
function extraerProveedor(texto) {
  const deMatch = texto.match(/De\s{2,}([A-ZÁÉÍÓÚÑ][^\n\r]+)/i);
  if (deMatch) return deMatch[1].trim();
  if (/roman/i.test(texto)) return 'Impresos Roman SPA';
  if (/antalis/i.test(texto)) return 'ANTALIS';
  if (/dulox/i.test(texto)) return 'DULOX';
  if (/lisichile/i.test(texto) || /lisi chile/i.test(texto)) return 'Lisi Chile';
  if (/ryr/i.test(texto)) return 'RYR Impresores';
  return null;
}

// ─── EXTRAER FECHA ────────────────────────────────────────────────────────
function extraerFecha(texto, nombreArchivo) {
  // Fecha en texto: DD/MM/YYYY o DD-MM-YYYY
  const m = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  // Fecha en nombre del archivo: DDMMYYYY o DD-MM-YYYY o DD-MM-YY
  const fm = nombreArchivo.match(/(\d{2})(\d{2})(\d{4})|(\d{2})-(\d{2})-(\d{2,4})/);
  if (fm) {
    if (fm[3]) return `${fm[3]}-${fm[2]}-${fm[1]}`;
    const y = fm[6].length === 2 ? '20'+fm[6] : fm[6];
    return `${y}-${fm[5]}-${fm[4]}`;
  }
  return new Date().toISOString().split('T')[0];
}

// ─── INFERIR TIPO DE PRODUCTO ─────────────────────────────────────────────
function inferirTipo(nombre) {
  const n = nombre.toLowerCase();
  if (/estuche|caja/.test(n)) return 'Embalaje';
  if (/etiqueta|sticker|label|sello/.test(n)) return 'Etiqueta';
  if (/hang.?tag/.test(n)) return 'Etiqueta';
  if (/balde|bidon|envase|botella/.test(n)) return 'Envase';
  return 'Insumo';
}

// ─── EXTRAER PRODUCTOS DEL TEXTO PDF ─────────────────────────────────────
function extraerProductosDePDF(texto, cliente, nombreArchivo, proveedor, fecha) {
  const rows = [];
  const tipo = inferirTipo(nombreArchivo);

  // Detectar líneas de producto: cantidad $precio o $precio cantidad
  const lineas = texto.split('\n');
  let cantidadGlobal = null;
  let precioUnitarioGlobal = null;
  let precioTotalGlobal = null;
  let productoNombre = null;

  // Intentar extraer nombre del producto del nombre del archivo
  const nombre = path.basename(nombreArchivo, path.extname(nombreArchivo));
  productoNombre = nombre
    .replace(/\d{6,}/g, '')        // quitar fechas numéricas
    .replace(/par cuatro\s*/gi, '')
    .replace(/cotizacion[_\s]*/gi, '')
    .replace(/presupuesto[_\s]*/gi, '')
    .replace(/nueva edita[_\s]*/gi, '')
    .replace(/final[_\s]*/gi, '')
    .replace(/[_\-]+/g, ' ')
    .replace(new RegExp(cliente, 'gi'), '')
    .replace(/\s+/g, ' ')
    .trim();
  if (productoNombre.length < 3) productoNombre = tipo + ' ' + cliente;

  // Buscar líneas con patrones de precio
  // Patrón: número grande = cantidad, $ número = precio unitario, $ número grande = total
  const precioLineas = texto.match(/[\$\s](\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:\+IVA)?/g) || [];
  const cantLineas   = texto.match(/^\s*(\d{3,5})\s+/gm) || [];

  // Estrategia simplificada: buscar el patrón "cantidad  $unitario  $total"
  const patronProducto = /(\d{3,6})\s+[^\n\$]{0,80}\$\s*([\d\.]+)\s*[\n\r\s]*\$?([\d\.]+)(?:\+IVA)?/g;
  let match;
  let encontrado = false;
  while ((match = patronProducto.exec(texto)) !== null) {
    const cant = parseInt(match[1].replace(/\./g,''));
    const pu   = parseFloat(match[2].replace(/\./g,'').replace(',','.'));
    const tot  = parseFloat(match[3].replace(/\./g,'').replace(',','.'));
    if (cant > 0 && pu > 0 && cant < 1000000 && pu < 10000000) {
      rows.push({
        proveedor:    proveedor || 'Impresos Roman SPA',
        producto:     productoNombre,
        tipo,
        fecha,
        proyecto:     cliente,
        cantidad:     cant,
        precio_total: tot || cant * pu,
        precio_unitario: pu,
        estado: 'pendiente',
        cantidad_anterior: null,
        precio_unitario_anterior: null,
      });
      encontrado = true;
    }
  }

  // Si no encontró líneas detalladas, crear registro resumen con el total
  if (!encontrado) {
    const totalMatch = texto.match(/\$([\d\.]+)\+IVA/);
    const cantMatch  = texto.match(/\b(\d{3,5})\b/);
    const tot  = totalMatch ? parseFloat(totalMatch[1].replace(/\./g,'')) : null;
    const cant = cantMatch  ? parseInt(cantMatch[1]) : null;
    if (tot && cant) {
      rows.push({
        proveedor:    proveedor || 'Impresos Roman SPA',
        producto:     productoNombre,
        tipo,
        fecha,
        proyecto:     cliente,
        cantidad:     cant,
        precio_total: tot,
        precio_unitario: tot / cant,
        estado: 'pendiente',
        cantidad_anterior: null,
        precio_unitario_anterior: null,
      });
    }
  }

  return rows;
}

// ─── PROCESAR XLSX ────────────────────────────────────────────────────────
function procesarXLSX(filePath, cliente) {
  const rows = [];
  try {
    const wb = XLSX.readFile(filePath);
    const nombre = path.basename(filePath, '.xlsx');
    const tipo = inferirTipo(nombre);

    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (data.length < 2) return;

      // Buscar filas que tengan cantidades y precios
      data.forEach((fila, idx) => {
        if (idx === 0) return; // saltar encabezado
        // Buscar columnas numéricas que parezcan cantidad y precio
        const nums = fila.map((v,i) => ({ v: typeof v === 'number' ? v : parseFloat(String(v).replace(/[$\.\s]/g,'')), i }))
                        .filter(x => !isNaN(x.v) && x.v > 0);
        if (nums.length < 2) return;

        // El primer texto de la fila = producto
        const textos = fila.filter(v => typeof v === 'string' && v.trim().length > 2);
        if (!textos.length) return;
        const producto = textos[0].trim();

        // Cantidades típicas: 100-10000, precios unitarios: 10-100000
        const cantCandidatos = nums.filter(n => n.v >= 100 && n.v <= 50000);
        const precioCandidatos = nums.filter(n => n.v >= 10 && n.v <= 5000000);

        if (cantCandidatos.length && precioCandidatos.length) {
          const cant = cantCandidatos[0].v;
          const pu   = precioCandidatos.find(p => p.v < cant * 100 && p.v > 5)?.v;
          if (cant && pu) {
            rows.push({
              proveedor: 'Ver archivo',
              producto:  producto.substring(0, 100),
              tipo,
              fecha:     new Date().toISOString().split('T')[0],
              proyecto:  cliente,
              cantidad:  cant,
              precio_total: cant * pu,
              precio_unitario: pu,
              estado: 'pendiente',
              cantidad_anterior: null,
              precio_unitario_anterior: null,
            });
          }
        }
      });
    });
  } catch(e) {
    console.log(`  ⚠ Error XLSX: ${e.message}`);
  }
  return rows;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
async function main() {
  const clientes = fs.readdirSync(BASE).filter(d => {
    const full = path.join(BASE, d);
    return fs.statSync(full).isDirectory() && !EXCLUIR.includes(d);
  });

  let totalInsertados = 0;
  let totalOmitidos   = 0;
  const errores = [];
  const omitidos = [];

  for (const cliente of clientes) {
    const clienteDir = path.join(BASE, cliente);
    // Buscar subcarpetas de cotizaciones
    let cotDirs = [];
    try {
      const subs = fs.readdirSync(clienteDir);
      subs.forEach(sub => {
        if (/cotizaci[oó]n|cotizaciones|presupuesto|pedido/i.test(sub)) {
          cotDirs.push(path.join(clienteDir, sub));
        }
      });
    } catch { continue; }

    if (!cotDirs.length) continue;
    console.log(`\n📁 Cliente: ${cliente}`);

    for (const cotDir of cotDirs) {
      let archivos = [];
      try {
        archivos = readdirRecursive(cotDir);
      } catch { continue; }

      for (const archivo of archivos) {
        const ext = path.extname(archivo).toLowerCase();
        const nombre = path.basename(archivo);
        const rows = [];

        try {
          if (ext === '.pdf') {
            const texto = await parsePDF(archivo);
            if (!texto.trim()) { omitidos.push(archivo); totalOmitidos++; continue; }
            const prov  = extraerProveedor(texto);
            const fecha = extraerFecha(texto, nombre);
            const encontrados = extraerProductosDePDF(texto, cliente, nombre, prov, fecha);
            rows.push(...encontrados);
          } else if (ext === '.xlsx') {
            rows.push(...procesarXLSX(archivo, cliente));
          } else {
            omitidos.push(archivo); totalOmitidos++; continue;
          }

          if (rows.length) {
            await supabaseInsert(rows);
            console.log(`  ✅ ${nombre} → ${rows.length} registro(s)`);
            totalInsertados += rows.length;
          } else {
            console.log(`  ⚠ ${nombre} → sin datos extraíbles`);
            omitidos.push(archivo); totalOmitidos++;
          }
        } catch(e) {
          console.log(`  ❌ ${nombre}: ${e.message}`);
          errores.push({ archivo, error: e.message });
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Registros insertados: ${totalInsertados}`);
  console.log(`⚠  Archivos sin datos:   ${totalOmitidos}`);
  console.log(`❌ Errores:              ${errores.length}`);

  if (omitidos.length) {
    fs.writeFileSync('omitidos.txt', omitidos.join('\n'), 'utf8');
    console.log('📄 Lista de omitidos guardada en omitidos.txt');
  }
}

function readdirRecursive(dir) {
  let result = [];
  try {
    fs.readdirSync(dir).forEach(f => {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) result.push(...readdirRecursive(full));
      else result.push(full);
    });
  } catch {}
  return result;
}

main().catch(console.error);
