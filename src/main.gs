/**
 * @fileoverview Punto de entrada de la webapp Rinde Fact.
 * Maneja el routing HTTP y la inclusión de archivos HTML parciales.
 *
 * @author  Devsohftt Studio
 * @version 2.1.0
 */

/**
 * Maneja las peticiones GET a la webapp.
 * Crea la página principal a partir del template `index.html`,
 * configura el título, el viewport y los permisos de iframe.
 *
 * NOTA SOBRE PATHS: HtmlService resuelve los archivos por NOMBRE, no por
 * ruta de filesystem. CLASP se encarga de subir todo lo que está en `rootDir`
 * (src/) al proyecto GAS como archivos planos — sin estructura de carpetas.
 * Por eso `createTemplateFromFile('index')` funciona igual independientemente
 * de dónde viva el archivo en el repo local.
 *
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Rinde Fact | Devsohftt')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Incluye el contenido de un archivo HTML parcial dentro de una plantilla.
 * Se utiliza en los templates con la sintaxis: `<?!= include('nombre') ?>`
 *
 * IMPORTANTE: el parámetro `filename` es el nombre del archivo tal como
 * existe en el proyecto GAS (sin extensión, sin path). CLASP sube los archivos
 * de `src/` como `styles`, `app`, `index`, etc. — no como `src/styles`.
 *
 * @param {string} filename - Nombre del archivo HTML a incluir (sin extensión).
 * @returns {string} El contenido HTML crudo del archivo solicitado.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
