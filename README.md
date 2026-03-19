# Rinde Fact — Documentación Técnica

**Versión:** 2.0.0  
**Plataforma:** Google Apps Script (Webapp)  
**Autor:** Devsohftt Studio  
**Timezone:** America/Argentina/Córdoba

---

## Tabla de contenidos

1. [Descripción general](#1-descripción-general)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Estructura de archivos](#3-estructura-de-archivos)
4. [Backend (Google Apps Script)](#4-backend-google-apps-script)
   - 4.1 [main.gs](#41-maings)
   - 4.2 [algorithm.gs](#42-algorithmgs)
5. [Frontend (HtmlService)](#5-frontend-htmlservice)
   - 5.1 [index.html](#51-indexhtml)
   - 5.2 [styles.html](#52-styleshtml)
   - 5.3 [app.html](#53-apphtml)
6. [Módulos JavaScript del cliente](#6-módulos-javascript-del-cliente)
   - 6.1 [Constantes](#61-constantes)
   - 6.2 [Estado](#62-estado)
   - 6.3 [Utilidades](#63-utilidades)
   - 6.4 [Persistencia (localStorage)](#64-persistencia-localstorage)
   - 6.5 [Gestión de facturas](#65-gestión-de-facturas)
   - 6.6 [Modos de operación](#66-modos-de-operación)
   - 6.7 [Renderizado de UI](#67-renderizado-de-ui)
   - 6.8 [Cálculo y comunicación con backend](#68-cálculo-y-comunicación-con-backend)
   - 6.9 [Impresión](#69-impresión)
7. [Algoritmo de optimización](#7-algoritmo-de-optimización)
8. [Flujo de datos](#8-flujo-de-datos)
9. [Configuración del proyecto (CLASP)](#9-configuración-del-proyecto-clasp)
10. [Guía de desarrollo local](#10-guía-de-desarrollo-local)
11. [Despliegue](#11-despliegue)
12. [Extensión y mantenimiento](#12-extensión-y-mantenimiento)

---

## 1. Descripción general

**Rinde Fact** es una herramienta web para gestión de rendiciones de cuentas. Permite al usuario:

- Cargar comprobantes (facturas) con detalle y monto.
- Definir un **tope de rendición** (monto máximo permitido).
- Calcular automáticamente el subconjunto de facturas que **más se acerque al tope sin superarlo**.
- Seleccionar facturas manualmente como alternativa al cálculo automático.
- Persistir el estado entre sesiones usando `localStorage`.
- Imprimir un reporte formateado.

La aplicación corre completamente sobre **Google Apps Script (GAS)** usando `HtmlService`, sin base de datos ni servicios externos (excepto Google Fonts y Tailwind CSS vía CDN).

---

## 2. Arquitectura del sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE (Browser)                       │
│                                                             │
│  index.html ──includes──► styles.html  (CSS)               │
│                 └───────► app.html     (JavaScript)         │
│                                                             │
│  Estado en memoria: facturas[], seleccionManualIds[], ...   │
│  Persistencia:      localStorage (clave: rindefact_data)    │
│                                                             │
│  Comunicación con backend:                                  │
│    google.script.run                                        │
│      .withSuccessHandler(actualizarUI)                      │
│      .withFailureHandler(_manejarErrorBackend)              │
│      .calcularMejorCombinacion(facturas, tope, seed)        │
└──────────────────────┬──────────────────────────────────────┘
                       │  HTTPS (Apps Script RPC)
┌──────────────────────▼──────────────────────────────────────┐
│                   SERVIDOR (Google Apps Script)              │
│                                                             │
│  main.gs       →  doGet(), include()                        │
│  algorithm.gs  →  calcularMejorCombinacion()                │
└─────────────────────────────────────────────────────────────┘
```

**Comunicación cliente ↔ servidor:**  
La única llamada al servidor en tiempo de ejecución es `calcularMejorCombinacion()`, invocada mediante la API `google.script.run`. Esta llamada es asíncrona; el callback de éxito es `actualizarUI()` y el de error es `_manejarErrorBackend()`.

---

## 3. Estructura de archivos

```
rindefact/
│
├── .clasp.json          # Configuración de CLASP (deploy tool)
├── appsscript.json      # Manifiesto de Google Apps Script
│
├── main.gs              # Entry point del servidor: doGet() + include()
├── algorithm.gs         # Algoritmo de optimización combinatoria
│
├── index.html           # Shell HTML principal (usa <?!= include() ?>)
├── styles.html          # Estilos CSS (incluido en index.html)
└── app.html             # Lógica JavaScript cliente (incluida en index.html)
```

> **Nota CLASP:** Los archivos `.gs` son código GAS server-side. Los `.html` son servidos por `HtmlService`. Los archivos `styles.html` y `app.html` **no son páginas independientes**: solo contienen fragmentos `<style>` y `<script>` que se inyectan en `index.html` en tiempo de renderizado.

---

## 4. Backend (Google Apps Script)

### 4.1 `main.gs`

Punto de entrada de la webapp. Contiene dos funciones públicas:

#### `doGet() → HtmlOutput`

Manejador de peticiones HTTP GET. GAS lo invoca automáticamente cuando un usuario accede a la URL de la webapp.

```javascript
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Rinde Fact | Devsohftt')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

| Parámetro/Método | Descripción |
|---|---|
| `createTemplateFromFile('index')` | Carga `index.html` como template (permite usar scriptlets `<?!= ?>`) |
| `.evaluate()` | Ejecuta los scriptlets y genera el HTML final |
| `.setTitle(...)` | Título de la pestaña del navegador |
| `.addMetaTag('viewport', ...)` | Asegura diseño responsive en móviles |
| `.setXFrameOptionsMode(ALLOWALL)` | Permite embeber la app en iframes |

#### `include(filename) → string`

Helper que permite a los templates HTML incluir otros archivos HTML via scriptlets.

```javascript
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

**Uso en templates:**
```html
<?!= include('styles') ?>   <!-- Incluye styles.html -->
<?!= include('app') ?>      <!-- Incluye app.html    -->
```

---

### 4.2 `algorithm.gs`

Módulo de optimización combinatoria. Expone una función pública al cliente.

#### `calcularMejorCombinacion(facturas, tope, refreshSeed) → ResultadoCombinacion`

| Parámetro | Tipo | Descripción |
|---|---|---|
| `facturas` | `Factura[]` | Array de facturas a analizar |
| `tope` | `number` | Monto máximo objetivo |
| `refreshSeed` | `number` (opcional, default `0`) | Si `> 0`, mezcla aleatoriamente los candidatos para explorar soluciones alternativas |

**Retorna:**
```typescript
{
  suma:             number,   // Suma total de la combinación encontrada
  idsSeleccionados: string[], // IDs de las facturas incluidas
  diferencia:       string    // (tope - suma) con 2 decimales
}
```

**Constantes internas:**

| Constante | Valor | Descripción |
|---|---|---|
| `TIMEOUT_MS` | `8000` | Tiempo máximo de ejecución (ms) |
| `FLOAT_TOLERANCE` | `0.0001` | Margen para comparaciones de punto flotante |

---

## 5. Frontend (HtmlService)

### 5.1 `index.html`

Shell HTML de la aplicación. Es un **template GAS** (no HTML estático puro), lo que permite usar scriptlets para incluir parciales.

**Secciones del layout:**

| Sección / ID | Descripción |
|---|---|
| `.print-header` | Cabecera visible solo al imprimir |
| `header` | Navbar con branding, botón "Borrar Todo" y toggle Auto/Manual |
| `aside.sidebar` | Panel lateral: formulario de ingreso + buscador + lista de facturas |
| `main#mainPanel` | Panel principal: input de tope + resultados |
| `#resultadoBox` | Contenedor de resultados (oculto por defecto) |
| `#emptyState` | Estado vacío (visible por defecto) |
| `#footerTotals` | Totales: combinación y diferencia |
| `#toast` | Toast de notificaciones del sistema |
| `footer` | Pie de página con copyright |

### 5.2 `styles.html`

Fragmento CSS puro (`<style>...</style>`). Se inyecta en el `<head>` de `index.html`.

**Variables CSS definidas:**

| Variable | Valor | Uso |
|---|---|---|
| `--color-primary` | `#1e40af` | Color principal (azul) |
| `--color-primary-dark` | `#1e3a8a` | Hover de elementos primarios |
| `--color-primary-bg` | `#eff6ff` | Fondo de facturas seleccionadas |
| `--color-alert` | `#f472b6` | Color de diferencia positiva |
| `--color-border` | `#e2e8f0` | Bordes generales |
| `--color-bg` | `#f8fafc` | Fondo de la aplicación |
| `--radius-card` | `0.75rem` | Radio de borde de tarjetas |
| `--transition-fast` | `0.15s ease` | Transición rápida para animaciones |

### 5.3 `app.html`

Fragmento JavaScript puro (`<script>...</script>`). Contiene toda la lógica del cliente, organizada en módulos comentados.

---

## 6. Módulos JavaScript del cliente

### 6.1 Constantes

```javascript
const CACHE_KEY = 'rindefact_data';  // Clave localStorage
const ID_PREFIX = 'f-';              // Prefijo de IDs de facturas
```

### 6.2 Estado

Variables globales que representan el estado de la aplicación en memoria:

| Variable | Tipo | Descripción |
|---|---|---|
| `facturas` | `Factura[]` | Lista de todas las facturas cargadas |
| `seleccionManualIds` | `string[]` | IDs seleccionados en modo manual |
| `editandoId` | `string \| null` | ID de la factura en edición (null si no hay) |
| `seed` | `number` | Semilla de variación para el modo automático (se incrementa con 🔄) |

### 6.3 Utilidades

| Función | Descripción |
|---|---|
| `generarId() → string` | Genera un ID único con timestamp (ej: `"f-1718300000000"`) |
| `formatearMoneda(valor) → string` | Formatea un número como `"$ 1.234,50"` (locale `es-AR`) |
| `mostrarToast(mensaje, tipo)` | Muestra un toast efímero de 3 segundos. `tipo`: `'info'` o `'error'` |

### 6.4 Persistencia (localStorage)

| Función | Descripción |
|---|---|
| `guardarCache()` | Serializa `facturas`, `tope`, `detalleTope`, `modoManual`, `seleccionManualIds` en `localStorage` |
| `cargarDatosCache()` | Restaura el estado desde `localStorage` al iniciar. Llama a `_sincronizarModo()` en el bloque `finally` para garantizar el renderizado inicial incluso si el JSON está corrupto |

**Estructura del objeto en localStorage (`rindefact_data`):**
```json
{
  "facturas": [
    { "id": "f-1718300000000", "monto": 15000.50, "detalle": "EPEC" }
  ],
  "tope": "50000",
  "detalleTope": "RENDICIÓN ENERO",
  "modoManual": false,
  "seleccionManualIds": []
}
```

### 6.5 Gestión de facturas

| Función | Descripción |
|---|---|
| `agregarFactura()` | Lee `#montoFactura` y `#detalleFactura`. Valida monto > 0. Agrega al array `facturas` y dispara recálculo |
| `borrarFactura(id)` | Elimina por ID de `facturas` y de `seleccionManualIds`. Dispara recálculo |
| `activarEdicion(id)` | Setea `editandoId = id`, bloquea el panel principal, re-renderiza la lista |
| `cancelarEdicion()` | Setea `editandoId = null`, desbloquea el panel, re-renderiza |
| `guardarEdicion(id)` | Lee los inputs del formulario inline, valida, actualiza `facturas[i]` y cancela la edición |
| `limpiarTodo()` | Pide confirmación, resetea todo el estado y limpia localStorage |

### 6.6 Modos de operación

**Modo Automático (default):** El cálculo de la mejor combinación lo realiza el servidor (algoritmo de backtracking en `algorithm.gs`).

**Modo Manual:** El usuario selecciona facturas haciendo click. La suma se calcula localmente sin llamada al servidor.

| Función | Descripción |
|---|---|
| `cambiarModo()` | Handler del toggle UI. Llama a `_sincronizarModo()` y guarda cache |
| `toggleSeleccionManual(id)` | Agrega/quita un ID de `seleccionManualIds`. Solo activo en modo manual |
| `_sincronizarModo()` *(privada)* | Limpia la selección al pasar a auto, muestra/oculta el botón 🔄, y dispara renderizado + recálculo |

### 6.7 Renderizado de UI

| Función | Descripción |
|---|---|
| `renderizarListaPrincipal()` | Renderiza el listado del sidebar aplicando el filtro de búsqueda. Actualiza el total ingresado |
| `_renderTarjetaFactura(f, isManual)` *(privada)* | Genera el HTML de una tarjeta de factura |
| `_renderFormEdicion(f)` *(privada)* | Genera el HTML del formulario de edición inline |
| `actualizarUI(resultado)` | Recibe el `ResultadoCombinacion`, actualiza el panel de resultados, marca las facturas tachadas y actualiza los labels de total y diferencia |
| `_limpiarResultados()` *(privada)* | Oculta `#resultadoBox` y muestra `#emptyState` |
| `_toggleBloqueo(bloquear)` *(privada)* | Aplica/quita la clase `disabled-overlay` en `#mainPanel` |

> **Convención de privacidad:** Las funciones prefijadas con `_` son internas y no deben invocarse desde el HTML directamente (solo desde otros módulos JS).

### 6.8 Cálculo y comunicación con backend

#### `recalcular(isRefresh = false)`

Función central de coordinación. Flujo de ejecución:

```
recalcular()
  │
  ├── guardarCache()
  │
  ├── [Modo Manual] → _calcularModoManual(tope)
  │                       → actualizarUI(resultado local)
  │
  └── [Modo Automático]
        ├── facturas vacías o tope = 0 → _limpiarResultados()
        └── google.script.run
              .withSuccessHandler(actualizarUI)
              .withFailureHandler(_manejarErrorBackend)
              .calcularMejorCombinacion(facturas, tope, seed)
```

| Función | Descripción |
|---|---|
| `recalcular(isRefresh)` | Coordina el recálculo según el modo activo. `isRefresh=true` incrementa `seed` para obtener resultado alternativo |
| `_calcularModoManual(tope)` *(privada)* | Suma los montos de `seleccionManualIds` y llama a `actualizarUI` localmente |
| `_manejarErrorBackend(error)` *(privada)* | Loguea el error y muestra un toast de error al usuario |

### 6.9 Impresión

#### `prepararEImprimir()`

Completa los elementos del `print-header` (título de rendición y fecha), luego llama a `window.print()`. Los estilos `@media print` en `styles.html` se encargan de ocultar elementos con clase `.no-print` y mostrar los de clase `.print-header`.

---

## 7. Algoritmo de optimización

El algoritmo resuelve una variante del **problema de la mochila 0/1** (0/1 Knapsack Problem):

> Dado un conjunto de N items (facturas), cada uno con un peso/valor (monto), encontrar el subconjunto cuya suma sea lo más cercana posible a un límite W (tope) sin superarlo.

### Estrategia: Backtracking con poda

```
candidatos = [f1(500), f2(300), f3(200), f4(150)]   (ordenados desc)
tope = 700

Árbol de búsqueda (rama izquierda = incluir, derecha = excluir):

                    buscar(0, 0)
                   /             \
          incluir f1(500)       excluir f1
          buscar(1, 500)        buscar(1, 0)
          /          \          /         \
    incl f2(300)  excl f2  incl f2(300)  excl f2
    suma=800 ❌    suma=500  suma=300     suma=0
    PODAR         /    \
               incl f3  excl f3
               suma=700 ✅  suma=500
               SOLUCIÓN EXACTA → RETORNAR
```

### Optimizaciones implementadas

| Optimización | Descripción |
|---|---|
| **Poda superior** | Si `sumaActual > tope + FLOAT_TOLERANCE`, la rama es inválida y se descarta |
| **Solución exacta** | Si `mejorSuma >= tope - FLOAT_TOLERANCE`, ya encontramos la solución óptima y se detiene la búsqueda |
| **Timeout** | Si se supera `TIMEOUT_MS` (8 segundos), se retorna el mejor resultado parcial encontrado hasta ese momento |
| **Filtrado previo** | Las facturas con `monto > tope` se descartan antes de comenzar la búsqueda |
| **Orden descendente** | Los candidatos se ordenan de mayor a menor para converger más rápido hacia la solución óptima (poda más agresiva en los primeros niveles) |
| **Aleatorización** | Cuando `refreshSeed > 0`, se mezcla el orden para explorar soluciones alternativas |

### Complejidad

| Dimensión | Valor |
|---|---|
| Complejidad teórica | O(2^n) |
| Casos prácticos | < 25-30 facturas: resolución exacta en ms |
| Casos grandes (50+ facturas) | Puede activar el timeout → solución parcial pero usable |

---

## 8. Flujo de datos

### Agregar una factura (modo automático)

```
[Usuario ingresa detalle + monto] → agregarFactura()
  → push a facturas[]
  → guardarCache()              → localStorage
  → renderizarListaPrincipal()  → DOM (lista sidebar)
  → recalcular()
      → google.script.run.calcularMejorCombinacion()  → GAS server
          → actualizarUI(resultado)                   ← callback
              → renderizado panel de resultados
              → marcado de tarjetas tachadas
```

### Ciclo de edición inline

```
[Click ✏️] → activarEdicion(id)
  → editandoId = id
  → _toggleBloqueo(true)         → overlay en mainPanel
  → renderizarListaPrincipal()   → muestra form inline en lugar de tarjeta

[Click Guardar] → guardarEdicion(id)
  → valida monto
  → actualiza facturas[i]
  → cancelarEdicion()
      → editandoId = null
      → _toggleBloqueo(false)
      → renderizarListaPrincipal()
  → recalcular()
```

### Carga inicial

```
body.onload → cargarDatosCache()
  → localStorage.getItem(CACHE_KEY)
  → restaurar facturas[], seleccionManualIds, tope, detalleTope, modoManual al DOM
  → finally: _sincronizarModo()
      → renderizarListaPrincipal()
      → recalcular()
```

---

## 9. Configuración del proyecto (CLASP)

### `.clasp.json`

```json
{
  "scriptId":        "...",         // ID del proyecto GAS en Google Drive
  "rootDir":         "",            // Directorio raíz local del proyecto
  "scriptExtensions": [".gs"],      // Extensiones tratadas como código GAS
  "htmlExtensions":  [".html"],     // Extensiones tratadas como HTML
  "jsonExtensions":  [".json"],     // Extensiones tratadas como JSON
  "filePushOrder":   [              // Orden de subida de archivos (opcional pero recomendado)
    "main.gs",
    "algorithm.gs",
    "styles.html",
    "app.html",
    "index.html"
  ]
}
```

### `appsscript.json`

```json
{
  "timeZone":        "America/Argentina/Buenos_Aires",
  "runtimeVersion":  "V8",           // Motor JavaScript moderno (ES2019+)
  "exceptionLogging": "STACKDRIVER", // Logs en Google Cloud Console
  "webapp": {
    "executeAs": "USER_DEPLOYING",   // El código corre con los permisos del dueño
    "access":    "ANYONE_ANONYMOUS"  // Acceso público sin login de Google
  }
}
```

---

## 10. Guía de desarrollo local

### Requisitos

```bash
node >= 18
npm  >= 8
```

### Instalación de CLASP

```bash
npm install -g @google/clasp
clasp login          # Abre el navegador para autenticar con Google
```

### Clonar el proyecto existente

```bash
# Opción A: clonar desde GAS al directorio actual
clasp clone <SCRIPT_ID>

# Opción B: usar el .clasp.json ya existente
clasp pull           # Descarga los archivos del servidor a local
```

### Ciclo de desarrollo

```bash
# 1. Editar archivos localmente en VS Code

# 2. Subir cambios al servidor GAS
clasp push

# 3. Ver logs en tiempo real (útil para depurar errores del servidor)
clasp logs --watch

# 4. Abrir el editor de GAS en el navegador (opcional)
clasp open
```

### VS Code — extensiones recomendadas

| Extensión | ID | Uso |
|---|---|---|
| Google Apps Script | `TrekkieCoder.gas-helper` | Sintaxis y autocompletado GAS |
| Prettier | `esbenp.prettier-vscode` | Formateo de código |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Autocompletado de clases Tailwind |
| ESLint | `dbaeumer.vscode-eslint` | Linting de JS |

### Variables de entorno y secretos

Este proyecto **no requiere variables de entorno**. No maneja credenciales ni API keys. El `scriptId` en `.clasp.json` identifica el proyecto GAS pero no es un secreto.

---

## 11. Despliegue

### Primera vez

1. Ir a [script.google.com](https://script.google.com) y abrir el proyecto.
2. Menú → **Implementar** → **Nueva implementación**.
3. Tipo: **Aplicación web**.
4. Ejecutar como: `Yo (usuario propietario)`.
5. Acceso: `Cualquier usuario` (para acceso público sin login).
6. Copiar la URL generada.

### Actualización de una implementación existente

```bash
clasp push   # Subir cambios

# Luego en el editor GAS:
# Implementar → Administrar implementaciones → Editar (lápiz) → Nueva versión → Implementar
```

> **Importante:** En GAS, cada deploy crea una versión inmutable. Para que los cambios sean visibles en la URL pública, hay que crear una nueva versión en el deploy existente.

### Verificar la implementación

```bash
clasp deployments   # Lista todas las implementaciones y sus URLs
```

---

## 12. Extensión y mantenimiento

### Agregar un nuevo campo a Factura

1. En `index.html`: agregar el input en el formulario del sidebar.
2. En `app.html` → `agregarFactura()`: incluir el nuevo campo en el `push` a `facturas`.
3. En `app.html` → `guardarCache()` / `cargarDatosCache()`: la serialización completa del array ya lo incluirá automáticamente.
4. En `app.html` → `_renderTarjetaFactura()`: mostrar el nuevo campo en la tarjeta.
5. En `app.html` → `_renderFormEdicion()` / `guardarEdicion()`: soporte de edición.

### Agregar una nueva variante del algoritmo

1. Crear un nuevo archivo `algorithm-v2.gs` con la función alternativa.
2. Agregar el nombre del archivo en `filePushOrder` en `.clasp.json`.
3. En `app.html` → `recalcular()`: agregar la lógica de selección entre variantes.

### Debugging del algoritmo en local (sin GAS)

El algoritmo en `algorithm.gs` es JavaScript puro compatible con Node.js. Para probarlo:

```javascript
// test-algorithm.js (Node.js)
// Copiar el contenido de algorithm.gs y agregar al final:

const facturas = [
  { id: 'f-1', monto: 150, detalle: 'TEST A' },
  { id: 'f-2', monto: 200, detalle: 'TEST B' },
  { id: 'f-3', monto: 300, detalle: 'TEST C' },
];
console.log(calcularMejorCombinacion(facturas, 350));
// Esperado: { suma: 350, idsSeleccionados: ['f-1', 'f-2'], diferencia: '0.00' }
```

```bash
node test-algorithm.js
```

---

*Documentación generada para Rinde Fact v2.0.0 — Devsohftt Studio © 2026*
