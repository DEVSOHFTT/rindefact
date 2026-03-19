/**
 * @fileoverview Módulo de algoritmo de optimización combinatoria para Rinde Fact.
 *
 * Implementa una búsqueda exhaustiva por backtracking (variante del problema
 * de la mochila 0/1) para encontrar el subconjunto de facturas cuya suma
 * total se aproxime al máximo al tope objetivo, sin superarlo.
 *
 * Complejidad teórica: O(2^n). Mitigado por:
 *   - Poda temprana (branch and bound).
 *   - Timeout configurable de 8 segundos.
 *   - Filtrado previo de facturas que superan el tope.
 *   - Opción de aleatorización para explorar soluciones alternativas.
 *
 * @author  Devsohftt Studio
 * @version 2.1.0
 */

// ─── Constantes del algoritmo ────────────────────────────────────────────────

/** Tiempo máximo de ejecución en milisegundos antes de retornar el mejor resultado parcial. */
const TIMEOUT_MS = 8000;

/** Tolerancia para comparaciones de punto flotante. */
const FLOAT_TOLERANCE = 0.0001;

// ─── Tipos (JSDoc) ────────────────────────────────────────────────────────────

/**
 * Representa una factura cargada en la aplicación.
 * @typedef {Object} Factura
 * @property {string} id      - Identificador único (ej: "f-1718300000000").
 * @property {number} monto   - Monto de la factura. Debe ser > 0.
 * @property {string} detalle - Descripción o nombre de la factura.
 */

/**
 * Resultado devuelto por el algoritmo de combinación.
 * @typedef {Object} ResultadoCombinacion
 * @property {number}   suma             - Suma total de la combinación encontrada.
 * @property {string[]} idsSeleccionados - IDs de las facturas incluidas en la combinación.
 * @property {string}   diferencia       - Diferencia `tope - suma`, formateada con 2 decimales.
 */

// ─── Función principal (pública — llamada desde el cliente via google.script.run) ─

/**
 * Calcula la mejor combinación de facturas que se aproxima al tope sin superarlo.
 *
 * @param {Factura[]} facturas       - Array de facturas a analizar.
 * @param {number}    tope           - Monto máximo objetivo de la rendición.
 * @param {number}   [refreshSeed=0] - Si es > 0, mezcla el orden de los candidatos
 *   aleatoriamente para explorar combinaciones alternativas al resultado previo.
 * @returns {ResultadoCombinacion}
 */
function calcularMejorCombinacion(facturas, tope, refreshSeed = 0) {
  // 1. Filtrar facturas inválidas o que ya superan el tope
  let candidatos = facturas.filter(f => f.monto > 0 && f.monto <= tope + FLOAT_TOLERANCE);

  // 2. Ordenar para mejorar la eficiencia de la poda
  if (refreshSeed > 0) {
    candidatos = candidatos.sort(() => Math.random() - 0.5);
  } else {
    // Orden descendente: explorar primero las facturas más grandes
    // acelera la convergencia hacia la solución óptima
    candidatos.sort((a, b) => b.monto - a.monto);
  }

  // 3. Estado mutable compartido entre las llamadas recursivas
  let mejorSuma = 0;
  let mejorCombinacionIds = [];
  const tiempoInicio = new Date().getTime();

  // 4. Búsqueda recursiva
  _buscarCombinacion(0, 0, [], candidatos, tope, tiempoInicio, {
    get mejorSuma() { return mejorSuma; },
    set mejorSuma(v) { mejorSuma = v; },
    get mejorCombinacionIds() { return mejorCombinacionIds; },
    set mejorCombinacionIds(v) { mejorCombinacionIds = v; }
  });

  return {
    suma: mejorSuma,
    idsSeleccionados: mejorCombinacionIds,
    diferencia: (tope - mejorSuma).toFixed(2)
  };
}

// ─── Función auxiliar de backtracking (privada) ───────────────────────────────

/**
 * Función recursiva interna de backtracking.
 * Explora el árbol de combinaciones con poda por límite superior y timeout.
 *
 * @param {number}    indice       - Índice del candidato a evaluar en esta llamada.
 * @param {number}    sumaActual   - Suma acumulada en la rama actual.
 * @param {string[]}  idsActuales  - IDs seleccionados en la rama actual.
 * @param {Factura[]} candidatos   - Array de candidatos ordenados.
 * @param {number}    tope         - Tope máximo objetivo.
 * @param {number}    tiempoInicio - Timestamp de inicio para control de timeout.
 * @param {Object}    estado       - Objeto de estado mutable compartido.
 * @private
 */
function _buscarCombinacion(indice, sumaActual, idsActuales, candidatos, tope, tiempoInicio, estado) {
  // Condiciones de corte
  if (estado.mejorSuma >= tope - FLOAT_TOLERANCE) return; // Solución exacta encontrada
  if ((new Date().getTime() - tiempoInicio) > TIMEOUT_MS) return; // Timeout alcanzado
  if (sumaActual > tope + FLOAT_TOLERANCE) return; // Rama inválida

  // Actualizar mejor solución parcial
  if (sumaActual > estado.mejorSuma) {
    estado.mejorSuma = sumaActual;
    estado.mejorCombinacionIds = [...idsActuales];
  }

  if (indice === candidatos.length) return;

  // Rama INCLUIR
  idsActuales.push(candidatos[indice].id);
  _buscarCombinacion(indice + 1, sumaActual + candidatos[indice].monto, idsActuales, candidatos, tope, tiempoInicio, estado);
  idsActuales.pop();

  // Rama EXCLUIR
  _buscarCombinacion(indice + 1, sumaActual, idsActuales, candidatos, tope, tiempoInicio, estado);
}
