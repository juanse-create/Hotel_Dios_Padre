// Ejercitar el mismo módulo que carga el navegador, sin duplicar su lógica.
const ui = require('../../public/cortesias-ui.js');

describe('Cortesías en interfaz antes de calcular importes', () => {
  it.each([
    '31',
    '44444444',
    '-1',
    '',
    'abc',
    '101',
    '30.001',
    '20.000',
    '1e1',
    'Infinity',
  ])('rechaza %p y no genera total ni saldo falsos', (texto) => {
    const validacion = ui.validarPorcentaje(texto, 30);
    expect(validacion.valido).toBe(false);
    expect(validacion.mensaje).not.toBe('');
    expect(ui.calcularImportes(2000, 100, validacion)).toEqual({
      subtotal: 2000,
      pagado: 100,
      descuento: null,
      total: null,
      saldo: null,
    });
  });
  it.each([[null], [undefined], [NaN], [-1], [101]])(
    'bloquea sin máximo válido: %p',
    (maximo) => {
      expect(ui.validarPorcentaje('20', maximo).valido).toBe(false);
    },
  );
  it('distingue una entrada numérica incompleta del valor cero', () => {
    expect(ui.validarPorcentaje('', 30, true).valido).toBe(false);
    expect(ui.validarPorcentaje('0', 30).valido).toBe(true);
  });
  it.each([
    [20, 30, 400, 1600, 1500],
    [30, 30, 600, 1400, 1300],
    [100, 100, 2000, 0, 0],
    [0, 30, 0, 2000, 1900],
  ])(
    'calcula %p con máximo %p',
    (porcentaje, maximo, descuento, total, saldo) => {
      const validacion = ui.validarPorcentaje(String(porcentaje), maximo);
      expect(validacion.valido).toBe(true);
      expect(ui.calcularImportes(2000, 100, validacion)).toEqual({
        subtotal: 2000,
        pagado: 100,
        descuento,
        total,
        saldo,
      });
    },
  );
  it('redondea el total a centavos sin errores de coma flotante', () => {
    const resultado = ui.calcularImportes(
      1.15,
      0,
      ui.validarPorcentaje('10', 30),
    );
    expect(resultado.total).toBe(1.04);
    expect(resultado.descuento).toBe(0.11);
    expect(resultado.saldo).toBe(1.04);
  });
  it('explica el máximo configurado', () => {
    expect(ui.validarPorcentaje('44444444', 30).mensaje).toBe(
      'La cortesía no puede superar el máximo autorizado del 30%.',
    );
  });
});
