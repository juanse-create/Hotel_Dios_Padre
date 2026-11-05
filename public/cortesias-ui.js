// La validación visual no sustituye la autorización transaccional del backend.
(function (root) {
  function validarPorcentaje(texto, maximo, entradaNumericaInvalida = false) {
    const invalido = (mensaje) => ({
      valido: false,
      porcentaje: null,
      mensaje,
    });
    if (
      typeof maximo !== 'number' ||
      !Number.isFinite(maximo) ||
      maximo < 0 ||
      maximo > 100
    )
      return invalido(
        'No se puede aplicar una cortesía hasta consultar el máximo autorizado.',
      );
    if (entradaNumericaInvalida)
      return invalido(
        'La cortesía debe ser un número con máximo dos decimales.',
      );
    if (typeof texto !== 'string' || texto.trim() === '')
      return invalido('Captura el porcentaje de cortesía; usa 0 si no aplica.');
    const valor = Number(texto);
    if (!Number.isFinite(valor))
      return invalido('La cortesía debe ser un número válido.');
    if (valor < 0) return invalido('La cortesía no puede ser negativa.');
    if (valor > maximo)
      return invalido(
        `La cortesía no puede superar el máximo autorizado del ${maximo}%.`,
      );
    if (!/^\d+(?:\.\d{1,2})?$/.test(texto))
      return invalido(
        'La cortesía debe ser un número con máximo dos decimales.',
      );
    return { valido: true, porcentaje: valor, mensaje: '' };
  }

  function calcularImportes(subtotal, pagado, validacion) {
    // No convertir una cortesía inválida en 0% ni un saldo desconocido en $0.
    const base = {
      subtotal,
      pagado,
      descuento: null,
      total: null,
      saldo: null,
    };
    if (!validacion.valido) return base;
    // Centavos y centésimas de porcentaje evitan perder un centavo por 1.15 * 0.9.
    const subtotalCentavos = Math.round(subtotal * 100);
    const pagadoCentavos = Math.round(pagado * 100);
    const factor = 10000 - Math.round(validacion.porcentaje * 100);
    const totalCentavos = Math.round((subtotalCentavos * factor) / 10000);
    return {
      ...base,
      total: totalCentavos / 100,
      descuento: (subtotalCentavos - totalCentavos) / 100,
      saldo: Math.max(0, totalCentavos - pagadoCentavos) / 100,
    };
  }

  const api = { validarPorcentaje, calcularImportes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CortesiasUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
