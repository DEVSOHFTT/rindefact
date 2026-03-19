# Rinde Fact — Documentación Técnica

**Versión:** 2.1.0 | **Plataforma:** Google Apps Script (Webapp) | **Autor:** Devsohftt Studio

---

## Tabla de contenidos

1. [Descripción general](#1-descripción-general)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Estructura de archivos](#3-estructura-de-archivos)
4. [Por qué rootDir apunta a src/](#4-por-qué-rootdir-apunta-a-src)
5. [Backend](#5-backend)
   - 5.1 [main.gs](#51-maings)
   - 5.2 [algorithm.gs](#52-algorithmgs)
6. [Frontend](#6-frontend)
   - 6.1 [index.html](#61-indexhtml)
   - 6.2 [styles.html](#62-styleshtml)
   - 6.3 [app.html](#63-apphtml)
7. [Módulos JavaScript del cliente](#7-módulos-javascript-del-cliente)
8. [Algoritmo de optimización](#8-algoritmo-de-optimización)
9. [Flujo de datos](#9-flujo-de-datos)
10. [Configuración CLASP](#10-configuración-clasp)
11. [Guía de desarrollo](#11-guía-de-desarrollo)
12. [Despliegue](#12-despliegue)
13. [Extensión y mantenimiento](#13-extensión-y-mantenimiento)

---

## 1. Descripción general

**Rinde Fact** es una herramienta web para gestión de rendiciones de cuentas. Permite:

- Cargar comprobantes (facturas) con detalle y monto.
- Definir un **tope de rendición** (monto máximo permitido).
- Calcular automáticamente el subconjunto de facturas que más se acerque al tope sin superarlo.
- Seleccionar facturas manualmente como alternativa.
- Persistir el estado entre sesiones con `localStorage`.
- Imprimir un reporte formateado.

Corre completamente sobre **Google Apps Script (GAS)** usando `HtmlService`, sin base de datos ni servicios externos (excepto Google Fonts y Tailwind CSS vía CDN).

---

## 2. Arquitectura del sistema

```
┌──────────────────────────────────────────────────────────────┐
│                       CLIENTE (Browser)                       │
│                                                              │
│  index.html ──include──► styles.html  (fragmento CSS)        │
│                └───────► app.html     (fragmento JS)         │
│                                                              │
│  Estado en memoria: facturas[], seleccionManualIds[], ...    │
│  Persistencia:      localStorage  (clave: rindefact_data)    │
│                                                              │
│  Comunicación con backend:                                   │
│    google.script.run                                         │
│      .withSuccessHandler(actualizarUI)                       │
│      .withFailureHandler(_manejarErrorBackend)               │
│      .calcularMejorCombinacion(facturas, tope, seed)         │
└───────────────────────┬──────────────────────────────────────┘
                        │  HTTPS (Apps Script RPC)
┌───────────────────────▼──────────────────────────────────────┐
│                  SERVIDOR (Google Apps Script)                │
│                                                              │
│  main.gs       →  doGet(), include()                         │
│  algorithm.gs  →  calcularMejorCombinacion()                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Estructura de archivos

```
rindefact/
│
├── .clasp.json          ← rootDir: "src" — CLASP sube solo lo que está en src/
├── .gitignore
├── README.md            ← Inicio rápido (raíz del repo)
│
└── src/                 ← Todo lo que llega al proyecto GAS
    ├── appsscript.json  ← Manifiesto GAS (timeZone, runtimeVersion, webapp config)
    │
    ├── main.gs          ← Entry point servidor
    ├── algorithm.gs     ← Algoritmo de optimización
    │
    ├── index.html       ← Shell HTML (template GAS con scriptlets)
    ├── styles.html      ← Parcial CSS
    └── app.html         ← Parcial JavaScript
```

---

## 4. Por qué `rootDir` apunta a `src/`

### El problema que resuelve

Sin `rootDir`, CLASP sube **todos** los archivos del repo al proyecto GAS, incluyendo `README.md`, `.gitignore` y cualquier otro archivo de configuración. Eso ensucia el proyecto GAS con archivos que no son código.

### Cómo funciona

`.clasp.json` declara `"rootDir": "src"`. CLASP lee solo ese directorio y sube sus archivos como archivos planos al proyecto GAS — **sin estructura de subcarpetas**.

```
Local (repo)          →    Google Apps Script (proyecto)
─────────────────────────────────────────────────────────
src/main.gs           →    main.gs
src/algorithm.gs      →    algorithm.gs
src/index.html        →    index.html
src/styles.html       →    styles.html
src/app.html          →    app.html
src/appsscript.json   →    appsscript.json
```

### Por qué los `include()` no cambian

`HtmlService.createHtmlOutputFromFile('styles')` busca un archivo llamado `styles` dentro del **proyecto GAS**, no en el filesystem local. Como CLASP ya subió `src/styles.html` como `styles`, el include funciona igual. No hay paths relativos en ningún lado.

---

## 5. Backend

### 5.1 `main.gs`

Punto de entrada. Dos funciones públicas:

#### `doGet() → HtmlOutput`

Invocada automáticamente por GAS ante cualquier petición GET a la URL de la webapp.

```javascript
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Rinde Fact | Devsohftt')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

| Método | Descripción |
|---|---|
| `createTemplateFromFile('index')` | Carga `index.html` como template (permite scriptlets `<?!= ?>`) |
| `.evaluate()` | Ejecuta los scriptlets y produce el HTML final |
| `.setXFrameOptionsMode(ALLOWALL)` | Permite embeber la app en iframes |

#### `include(filename) → string`

```javascript
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

Uso en templates:
```html
<?!= include('styles') ?>
<?!= include('app') ?>
```

---

### 5.2 `algorithm.gs`

Módulo de optimización. Expone `calcularMejorCombinacion()` al cliente via `google.script.run`.

#### `calcularMejorCombinacion(facturas, tope, refreshSeed) → ResultadoCombinacion`

| Parámetro | Tipo | Descripción |
|---|---|---|
| `facturas` | `Factura[]` | Array de facturas a analizar |
| `tope` | `number` | Monto máximo objetivo |
| `refreshSeed` | `number` (opcional) | Si > 0, mezcla aleatoriamente los candidatos |

**Retorna:**

```typescript
{
  suma:             number,   // Suma de la combinación encontrada
  idsSeleccionados: string[], // IDs de las facturas incluidas
  diferencia:       string    // (tope - suma) con 2 decimales
}
```

**Constantes:**

| Constante | Valor | Descripción |
|---|---|---|
| `TIMEOUT_MS` | `8000` | Tiempo máximo de ejecución (ms) |
| `FLOAT_TOLERANCE` | `0.0001` | Margen para comparaciones de punto flotante |

---

## 6. Frontend

### 6.1 `index.html`

Shell HTML. Template GAS que incluye los parciales de CSS y JS.

| Sección / ID | Descripción |
|---|---|
| `.print-header` | Cabecera visible solo con `@media print` |
| `header` | Navbar: branding, Borrar Todo, toggle Auto/Manual |
| `aside.sidebar` | Formulario de ingreso + buscador + lista de facturas |
| `main#mainPanel` | Input de tope + panel de resultados |
| `#resultadoBox` | Contenedor de resultados (oculto por defecto) |
| `#emptyState` | Placeholder vacío (visible por defecto) |
| `#footerTotals` | Labels: total combinación y diferencia |
| `#toast` | Notificaciones efímeras del sistema |

### 6.2 `styles.html`

Fragmento `<style>` inyectado en el `<head>` de `index.html`.

**Variables CSS:**

| Variable | Valor | Uso |
|---|---|---|
| `--color-primary` | `#1e40af` | Color principal (azul) |
| `--color-primary-dark` | `#1e3a8a` | Hover |
| `--color-primary-bg` | `#eff6ff` | Fondo de facturas seleccionadas |
| `--color-alert` | `#f472b6` | Diferencia positiva |
| `--color-border` | `#e2e8f0` | Bordes |
| `--color-bg` | `#f8fafc` | Fondo de la app |
| `--transition-fast` | `0.15s ease` | Animaciones rápidas |

### 6.3 `app.html`

Fragmento `<script>` con toda la lógica cliente. Organizado en módulos delimitados.

---

## 7. Módulos JavaScript del cliente

### Convenciones

- Las funciones prefijadas con `_` son **privadas**: no deben invocarse desde el HTML.
- El estado vive en variables globales (necesario por el sandbox de GAS/HtmlService).
- Cada mutación de estado llama `guardarCache()` para persistir.

### Módulos

| Módulo | Funciones principales |
|---|---|
| **Constantes** | `CACHE_KEY`, `ID_PREFIX` |
| **Estado** | `facturas`, `seleccionManualIds`, `editandoId`, `seed` |
| **Utilidades** | `generarId()`, `formatearMoneda()`, `mostrarToast()` |
| **Persistencia** | `guardarCache()`, `cargarDatosCache()` |
| **Gestión de facturas** | `agregarFactura()`, `borrarFactura()`, `activarEdicion()`, `cancelarEdicion()`, `guardarEdicion()`, `limpiarTodo()` |
| **Modos** | `cambiarModo()`, `toggleSeleccionManual()`, `_sincronizarModo()` |
| **Renderizado** | `renderizarListaPrincipal()`, `_renderTarjetaFactura()`, `_renderFormEdicion()`, `actualizarUI()`, `_limpiarResultados()`, `_toggleBloqueo()` |
| **Cálculo** | `recalcular()`, `_calcularModoManual()`, `_manejarErrorBackend()` |
| **Impresión** | `prepararEImprimir()` |

### Objeto de caché en localStorage

```json
{
  "facturas": [{ "id": "f-...", "monto": 1500.00, "detalle": "EPEC" }],
  "tope": "50000",
  "detalleTope": "RENDICIÓN ENERO",
  "modoManual": false,
  "seleccionManualIds": []
}
```

---

## 8. Algoritmo de optimización

Variante del **problema de la mochila 0/1** resuelta por backtracking con poda.

### Optimizaciones

| Técnica | Descripción |
|---|---|
| Poda superior | Rama descartada si `suma > tope + TOLERANCE` |
| Stop en exacto | Se detiene si `mejorSuma >= tope - TOLERANCE` |
| Timeout | Retorna resultado parcial al superar 8 segundos |
| Filtrado previo | Facturas con `monto > tope` se excluyen antes de empezar |
| Orden descendente | Candidatos de mayor a menor → convergencia más rápida |
| Aleatorización | `refreshSeed > 0` mezcla el orden para resultados alternativos |

### Complejidad

| Escenario | Comportamiento |
|---|---|
| < 30 facturas | Resolución exacta en milisegundos |
| 30-50 facturas | Segundos, generalmente exacto |
| > 50 facturas | Puede activar timeout → solución parcial usable |

---

## 9. Flujo de datos

### Agregar una factura (modo auto)

```
agregarFactura()
  → push a facturas[]
  → guardarCache() → localStorage
  → renderizarListaPrincipal() → DOM sidebar
  → recalcular()
      → google.script.run.calcularMejorCombinacion()
          → actualizarUI(resultado) ← callback
              → panel de resultados + tarjetas tachadas
```

### Carga inicial

```
body.onload → cargarDatosCache()
  → localStorage.getItem(CACHE_KEY)
  → restaurar estado al DOM
  → finally: _sincronizarModo()
      → renderizarListaPrincipal() + recalcular()
```

---

## 10. Configuración CLASP

### `.clasp.json` (en la raíz del repo)

```json
{
  "scriptId":       "...",
  "rootDir":        "src",
  "filePushOrder":  ["main.gs", "algorithm.gs", "styles.html", "app.html", "index.html"]
}
```

> `rootDir: "src"` es el cambio clave respecto a la estructura anterior. Le dice a CLASP que solo suba los archivos dentro de `src/`.

### `src/appsscript.json`

```json
{
  "timeZone":        "America/Argentina/Buenos_Aires",
  "runtimeVersion":  "V8",
  "exceptionLogging": "STACKDRIVER",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access":    "ANYONE_ANONYMOUS"
  }
}
```

> `appsscript.json` debe estar dentro de `src/` (el `rootDir`) para que CLASP lo incluya al hacer `push`.

---

## 11. Guía de desarrollo

### Requisitos

```
Node.js >= 18
npm >= 8
```

### Comandos

```bash
npm install -g @google/clasp   # Instalar CLASP
clasp login                    # Autenticarse (abre el navegador)
clasp pull                     # Descargar desde GAS → local
clasp push                     # Subir local → GAS
clasp logs --watch             # Ver logs del servidor en tiempo real
clasp open                     # Abrir el editor GAS en el navegador
clasp deployments              # Listar implementaciones activas
```

### Extensiones VS Code recomendadas

| Extensión | ID |
|---|---|
| Google Apps Script | `TrekkieCoder.gas-helper` |
| Prettier | `esbenp.prettier-vscode` |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` |
| ESLint | `dbaeumer.vscode-eslint` |

### Debug del algoritmo sin GAS

`algorithm.gs` es JS puro compatible con Node.js:

```bash
# Copiar algorithm.gs a test-algorithm.js y agregar al final:
node -e "
const f = [
  {id:'f-1', monto:150, detalle:'A'},
  {id:'f-2', monto:200, detalle:'B'},
  {id:'f-3', monto:300, detalle:'C'},
];
console.log(calcularMejorCombinacion(f, 350));
// → { suma: 350, idsSeleccionados: ['f-1','f-2'], diferencia: '0.00' }
" test-algorithm.js
```

---

## 12. Despliegue

### Primera vez

1. Abrir [script.google.com](https://script.google.com) y el proyecto.
2. **Implementar → Nueva implementación**.
3. Tipo: **Aplicación web** | Ejecutar como: **Yo** | Acceso: **Cualquier usuario**.
4. Copiar la URL generada.

### Actualizar implementación existente

```bash
clasp push
# Luego en GAS: Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar
```

---

## 13. Extensión y mantenimiento

### Agregar un campo a Factura

1. `src/index.html`: agregar el input en el formulario del sidebar.
2. `src/app.html → agregarFactura()`: incluir el campo en el `push` a `facturas[]`.
3. `_renderTarjetaFactura()` / `_renderFormEdicion()` / `guardarEdicion()`: actualizar la vista.
4. La serialización en `guardarCache()` / `cargarDatosCache()` lo toma automáticamente.

### Agregar una segunda hoja de estilos

1. Crear `src/styles-print.html` con el CSS adicional.
2. En `src/index.html`: agregar `<?!= include('styles-print') ?>` después del include existente.
3. CLASP lo subirá en el próximo `clasp push`.

### Agregar un módulo JS adicional

1. Crear `src/mi-modulo.html` con el `<script>` correspondiente.
2. En `src/index.html`: agregar `<?!= include('mi-modulo') ?>` antes del cierre de `</body>`.
3. Agregar `"mi-modulo.html"` a `filePushOrder` en `.clasp.json`.

---

*Documentación técnica de Rinde Fact v2.1.0 — Devsohftt Studio © 2026*
