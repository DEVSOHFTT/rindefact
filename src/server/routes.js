/**
 * @fileoverview Controlador principal de la WebApp (Backend).
 * Se encarga de interceptar las peticiones HTTP GET y compilar la vista principal
 * inyectando los fragmentos de HTML, CSS y JS correspondientes.
 * * @author Devsohftt Studio
 * @version 2.1.0
 */

/**
 * Función reservada de Google Apps Script. 
 * Se ejecuta automáticamente cuando un usuario ingresa a la URL de la WebApp.
 * * @param {Object} e - Objeto del evento HTTP (parámetros de la URL, etc.)
 * @returns {GoogleAppsScript.HTML.HtmlOutput} El HTML compilado listo para el navegador.
 */
function doGet(e) {
  // HtmlService compila el template principal.
  // Nota: Al usar clasp con subcarpetas, las rutas relativas se mantienen.
  return HtmlService.createTemplateFromFile('client/views/layout')
    .evaluate() // Procesa los tags <?!= ... ?>
    .setTitle('Rinde Fact | Devsohftt') // Título en la pestaña del navegador
    .addMetaTag('viewport', 'width=device-width, initial-scale=1') // Diseño responsive
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // Permite embeber en iframes
}

/**
 * Función de utilidad (Helper) para los templates HTML.
 * Permite modularizar el código frontend inyectando archivos secundarios
 * (como hojas de estilo y scripts) dentro del layout principal.
 * * IMPORTANTE: Es invocada desde layout.html mediante la sintaxis <?!= include('ruta') ?>
 * * @param {string} filename - La ruta del archivo a incluir (sin la extensión .html final).
 * @returns {string} El contenido en texto crudo del archivo solicitado.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}