# Dashboard de Cotizaciones — Par Cuatro

## ¿Qué es este proyecto?

Aplicación web local (HTML + JavaScript puro) para gestionar y comparar cotizaciones de proveedores en Par Cuatro. No requiere servidor ni instalación: se abre directamente en el navegador.

## Contexto del negocio

Par Cuatro es una sub-empresa de Aroma Center. Elabora productos de aromatización (difusores, fragancias, etiquetas, embalajes, etc.) y solicita cotizaciones a sus proveedores para insumos y materiales. El objetivo del dashboard es:

- Comparar precios y cantidades entre cotizaciones nuevas y anteriores del mismo proveedor/producto
- Aprobar o rechazar cotizaciones con un flujo claro
- Generar automáticamente el correo para solicitar el **Visto Bueno (VB)** al proveedor cuando se aprueba una cotización
- Estimar el consumo anual de etiquetas por tipo, basado en el historial de proyectos

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

1. **Cotizaciones** — tabla comparativa con semáforo de variación de precio y cantidad
2. **Nueva Cotización** — formulario de ingreso; detecta automáticamente la cotización anterior del mismo proveedor/producto
3. **Estimador de Etiquetas** — registro de consumo por proyecto y tipo; calcula estimado anual

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

- Al guardar una cotización nueva, el sistema busca automáticamente la más reciente del mismo proveedor + producto como referencia anterior
- El semáforo compara precio unitario (no precio total) para ser justo cuando cambia la cantidad
- Al aprobar, genera un correo formal solicitando el VB, listo para copiar y pegar en el cliente de correo
- El estimado anual de etiquetas usa el rango real de fechas del historial para calcular el promedio mensual × 12

## Decisiones de diseño

- **Sin backend ni base de datos**: toda la información vive en localStorage del navegador. Simple y sin dependencias.
- **Un solo archivo HTML**: fácil de compartir, mover o hacer backup.
- **Envío de correo manual**: el usuario copia el correo generado y lo envía desde su propio cliente de correo (Outlook, Gmail, etc.).
