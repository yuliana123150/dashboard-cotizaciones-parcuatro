# Dashboard de Cotizaciones — Par Cuatro

## ¿Qué es este proyecto?

Aplicación web local (HTML + JavaScript puro) para gestionar y comparar cotizaciones de proveedores en Par Cuatro. No requiere servidor ni instalación: se abre directamente en el navegador.

## Contexto del negocio

Par Cuatro es una sub-empresa de Aroma Center. Elabora productos de aromatización (difusores, fragancias, etiquetas, embalajes, etc.) y solicita cotizaciones a sus proveedores para insumos y materiales. El objetivo del dashboard es:

- Comparar precios y cantidades de un mismo producto entre distintos proveedores y fechas
- Aprobar o rechazar cotizaciones con un flujo claro
- Generar automáticamente el correo para solicitar el **Visto Bueno (VB)** al proveedor cuando se aprueba una cotización
- Estimar el consumo anual de cualquier insumo por tipo, basado en el historial de proyectos

## ¿Qué es el VB (Visto Bueno)?

Cuando se aprueba una cotización, el proveedor envía un PDF de arte final (VB) para que Aroma Center verifique que el documento corresponde al diseño y especificaciones originales antes de producir.

## Estructura de archivos

```
DASHBOARD COTIZACIONES/
├── CLAUDE.md       ← este archivo
└── index.html      ← app completa (HTML + CSS + JS en un solo archivo)
```

## Tecnología

- HTML5 + CSS3 + JavaScript vanilla (sin frameworks)
- Datos persistidos en `localStorage` del navegador
- Sin dependencias externas ni CDN

## Secciones del dashboard

1. **Cotizaciones** — tabla agrupada por producto con semáforo de variación de precio y cantidad; filtros por proveedor, cliente, estado y producto
2. **Nueva Cotización** — formulario de ingreso; detecta automáticamente la cotización más reciente del mismo producto (cualquier proveedor) como referencia
3. **Estimador de Insumos** — registro de consumo de cualquier insumo por proyecto y categoría; calcula estimado anual con filtro por categoría

## Campos de una cotización

| Campo | Descripción |
|---|---|
| Proveedor | Nombre del proveedor |
| Producto | Nombre del insumo o material |
| Tipo | Etiqueta, Embalaje, Envase, Insumo, Materia Prima, Otro |
| Unidad | unidades, kg, litros, etc. |
| Cantidad | Cantidad cotizada |
| Precio Total | Precio total de la cotización |
| Precio Unitario | Calculado automáticamente (precio total ÷ cantidad) |
| Fecha | Fecha de la cotización |
| Proyecto | Cliente o proyecto asociado (opcional) |
| Correo proveedor | Para el correo de VB |
| Contacto | Nombre del contacto en el proveedor |
| Notas | Condiciones especiales, plazo de entrega, etc. |

## Comportamiento clave

- Al guardar una cotización nueva, el sistema busca la más reciente del mismo **producto** (sin importar proveedor) como referencia — permite comparar entre proveedores
- El semáforo compara precio unitario (no precio total) para ser justo cuando cambia la cantidad
- Al aprobar, genera un correo formal solicitando el VB, listo para copiar y pegar en el cliente de correo
- El estimado anual de insumos usa el rango real de fechas del historial para calcular el promedio mensual × 12
- Lista de 35 clientes hardcodeada como datalist — autocompletado en todos los campos de proyecto/cliente

## Decisiones de diseño

- **Sin backend ni base de datos**: toda la información vive en localStorage del navegador. Simple y sin dependencias.
- **Un solo archivo HTML**: fácil de compartir, mover o hacer backup.
- **Envío de correo manual**: el usuario copia el correo generado y lo envía desde su propio cliente de correo (Outlook, Gmail, etc.).
- **Comparación por producto, no por proveedor**: decisión deliberada para poder ver variaciones de precio en el mercado independientemente del proveedor.

## Despliegue

| Entorno | URL |
|---|---|
| Producción (Vercel) | https://dashboard-cotizaciones-parcuatro.vercel.app |
| Repositorio GitHub | https://github.com/yuliana123150/dashboard-cotizaciones-parcuatro |

## Historial de versiones

### v1.1.0 — 2026-05-19
Mejoras post-lanzamiento:

**Conexión a Supabase (base de datos en la nube)**
- Migración de localStorage → Supabase (PostgreSQL)
- Tabla `cotizaciones` y tabla `insumos`; RLS con políticas permisivas (anon puede leer/escribir)
- Caché global `_cotizaciones` / `_insumos` para mantener onclick handlers síncronos

**Importación masiva de historial**
- Script `importar.js` (Node.js) que escanea todas las carpetas de clientes
- Lee PDFs con `pdf2json` y Excel con `xlsx`
- Extrae: proveedor, fecha, producto, tipo, cantidad, precio unitario, precio total
- 421 registros históricos importados desde 28 clientes en la primera ejecución
- Archivos sin datos extraíbles guardados en `omitidos.txt`

**Panel de historial en tiempo real (Nueva Cotización)**
- Al escribir el nombre del producto aparece un panel con cotizaciones anteriores de ese mismo producto
- Autocompletado con todos los productos del historial (datalist dinámico)
- Comparador en vivo: mientras llenas cantidad y precio, muestra si estás cotizando más caro o más barato que la última referencia, con porcentaje de variación

**Mockup — Nueva Cotización v2 (subir archivo)**
- Archivo `mockup-nueva-cot.html`: prototipo visual del flujo de subida de PDF/Excel
- Flujo diseñado: ① subir archivo → ② revisar datos extraídos (editables) → ③ comparación con historial + guardar
- Pendiente de implementar en el dashboard real

### v1.0.0 — 2026-05-19
Primera versión publicada. Incluye:
- Comparativo de cotizaciones agrupado por producto
- Semáforo de variación de precio y cantidad
- Flujo de aprobación con generador de correo para VB
- Estimador de insumos (todos los tipos, no solo etiquetas)
- 35 clientes de Par Cuatro precargados como autocompletado
- Filtros por proveedor, cliente, estado y producto
