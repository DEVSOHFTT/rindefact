function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Rinde Fact | Devsohftt')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); 
}

function calcularMejorCombinacion(facturas, tope, refreshSeed = 0) {
  let nums = facturas.filter(f => f.monto > 0);
  if (refreshSeed > 0) {
    nums = nums.sort(() => Math.random() - 0.5);
  } else {
    nums.sort((a, b) => b.monto - a.monto);
  }
  
  let mejorSuma = 0;
  let mejorCombinacionIds = [];
  let tiempoInicio = new Date().getTime();

  function buscar(indice, sumaActual, idsActuales) {
    if (mejorSuma === tope || (new Date().getTime() - tiempoInicio) > 8000) return;
    if (sumaActual > (tope + 0.0001)) return;

    if (sumaActual > mejorSuma) {
      mejorSuma = sumaActual;
      mejorCombinacionIds = [...idsActuales];
    }
    if (indice === nums.length) return;

    idsActuales.push(nums[indice].id);
    buscar(indice + 1, sumaActual + nums[indice].monto, idsActuales);
    idsActuales.pop();
    buscar(indice + 1, sumaActual, idsActuales);
  }

  buscar(0, 0, []);

  return {
    suma: mejorSuma,
    idsSeleccionados: mejorCombinacionIds,
    diferencia: (tope - mejorSuma).toFixed(2)
  };
}