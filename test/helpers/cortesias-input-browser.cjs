const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');

async function inputBrowserChecks({ baseURL, password }) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
  const evidence = process.env.EVIDENCE_DIR || 'docs/evidence';
  mkdirSync(evidence, { recursive: true });
  let checks = 0;
  try {
    const login = await fetch(baseURL + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'test_super', password }),
    });
    assert.equal(login.status, 200);
    const { access_token } = await login.json();
    async function limite(maximoPorcentaje) {
      const response = await fetch(baseURL + '/api/configuracion/cortesias', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + access_token,
        },
        body: JSON.stringify({ maximoPorcentaje }),
      });
      assert.equal(response.status, 200);
    }
    await limite(30);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
    });
    await context.route('**/*', (r) =>
      r.request().url().startsWith(baseURL) ? r.continue() : r.abort(),
    );
    const page = await context.newPage();
    const errors = [];
    const dialogs = [];
    let requests = 0;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      return dialog.accept();
    });
    page.on('request', (r) => {
      if (
        /\/api\/reservaciones(?:\/\d+)?$/.test(r.url()) &&
        ['POST', 'PATCH'].includes(r.method())
      )
        requests++;
    });
    await page.goto(baseURL);
    await page.locator('#tipo').selectOption('Administrador');
    await page.locator('#usuario').fill('test_admin');
    await page.locator('#password').fill(password);
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/admin.html');
    const input = page.locator('[name=cortesiaPorcentaje]');
    const button = page.locator('[data-guardar-reserva]');
    async function abrir(modulo) {
      await page.evaluate(async () => {
        if (typeof liberarBloqueosReserva === 'function')
          await liberarBloqueosReserva();
      });
      await page.locator('#nav button').filter({ hasText: modulo }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('[name=cortesiaPorcentaje]')?.dataset
            .maximoAutorizado !== undefined,
      );
    }
    async function preparar() {
      await page.locator('[name=nombre]').fill('Cliente');
      await page.locator('[name=apellidoPaterno]').fill('Sintético');
      await page.locator('[name=telefono]').fill('0000000000');
      await page.locator('[name=fechaInicio]').fill('2103-01-01');
      await page.locator('[name=fechaFin]').fill('2103-01-03');
      await page
        .locator('button')
        .filter({ hasText: 'Buscar habitaciones' })
        .click();
      const bloqueada = page.waitForResponse(
        (r) =>
          r.url().includes('/reservaciones/bloqueo/') &&
          r.request().method() === 'POST',
      );
      await page
        .locator('.available-room')
        .filter({ hasText: 'TEST-REG' })
        .locator('input')
        .check();
      assert.equal((await bloqueada).status(), 201);
      await page.locator('#pago_metodo').selectOption('Transferencia bancaria');
      await page.locator('#pago_importe').fill('100');
      await page.locator('#pago_banco').fill('Banco de prueba');
      await page.locator('#pago_referencia').fill('REGRESION');
      await page
        .locator('button')
        .filter({ hasText: 'Agregar pago a la reservación' })
        .click();
    }
    async function matriz(nombre) {
      for (const [porcentaje, descuento, total, saldo] of [
        ['20', '$400.00', '$1600.00', '$1500.00'],
        ['30', '$600.00', '$1400.00', '$1300.00'],
      ]) {
        await input.fill(porcentaje); // Afirmaciones antes de blur: comprueba oninput.
        assert.equal(await button.isDisabled(), false);
        assert.equal(await page.locator('#errorCortesia').isVisible(), false);
        assert.equal(
          await page.locator('#resumen_descuento_reserva').textContent(),
          descuento,
        );
        assert.equal(
          await page.locator('#resumen_total_reserva').textContent(),
          total,
        );
        assert.equal(
          await page.locator('#resumen_saldo_pendiente').textContent(),
          saldo,
        );
        if (nombre === 'reservaciones') {
          await page.locator('#resumen_total_reserva').scrollIntoViewIfNeeded();
          await page.screenshot({
            path: `${evidence}/cortesia-valida-${porcentaje}.png`,
            fullPage: true,
          });
        }
        checks += 5;
      }
      for (const valor of [
        '31',
        '44444444',
        '-1',
        '',
        '101',
        '20.123',
        'no-numerico',
      ]) {
        if (valor === 'no-numerico') {
          await input.fill('');
          await input.pressSequentially('e');
        } else await input.fill(valor);
        assert.equal(await button.isDisabled(), true);
        assert.equal(await page.locator('#errorCortesia').isVisible(), true);
        assert.equal(await input.getAttribute('aria-invalid'), 'true');
        assert.equal(
          await page.locator('#pago_total_manual').inputValue(),
          '2000.00',
        );
        assert.equal(
          await page.locator('#resumen_total_pagado').textContent(),
          '$100.00',
        );
        for (const id of [
          'resumen_descuento_reserva',
          'resumen_total_reserva',
          'resumen_saldo_pendiente',
        ])
          assert.equal(await page.locator('#' + id).textContent(), '—');
        const antes = requests;
        await page.evaluate(() => guardarReserva());
        assert.equal(requests, antes);
        if (valor === '44444444') {
          assert.equal(
            await page.locator('#errorCortesia').textContent(),
            'La cortesía no puede superar el máximo autorizado del 30%.',
          );
          await page.locator('#resumen_total_reserva').scrollIntoViewIfNeeded();
          await page.screenshot({
            path: `${evidence}/cortesia-invalida-${nombre}.png`,
            fullPage: true,
          });
        }
        checks += 9;
      }
      await input.fill('30');
      assert.equal(await button.isDisabled(), false);
      checks++;
    }
    await abrir('Reservaciones');
    await preparar();
    await matriz('reservaciones');
    await abrir('Recepción');
    await preparar();
    await matriz('recepcion');
    // Cargar por el mismo editor usado por los botones de ambos módulos.
    for (const [modulo, nombre] of [
      ['Reservaciones', 'edicion-reservaciones'],
      ['Recepción', 'edicion-recepcion'],
    ]) {
      await abrir(modulo);
      await page.evaluate(async () => {
        const rows = await api('/reservaciones');
        const row = rows.find((r) =>
          r.habitaciones_detalle?.includes('TEST-UI'),
        );
        if (!row) throw Error('Falta reserva sintética para edición');
        await editarReserva(row);
      });
      await page.waitForFunction(
        () =>
          document.querySelector('[name=cortesiaPorcentaje]')?.dataset
            .maximoAutorizado === '30',
      );
      await matriz(nombre);
    }
    await limite(100);
    await abrir('Reservaciones');
    await preparar();
    await input.fill('100');
    assert.equal(await button.isDisabled(), false);
    assert.equal(
      await page.locator('#resumen_total_reserva').textContent(),
      '$0.00',
    );
    assert.equal(
      await page.locator('#resumen_saldo_pendiente').textContent(),
      '$0.00',
    );
    await page.screenshot({
      path: `${evidence}/cortesia-valida-100.png`,
      fullPage: true,
    });
    // Eliminar el único pago con el control real; 100% no elimina su obligatoriedad.
    await page.locator('#tbody_pagos_reserva button').click();
    const antes = requests;
    await button.click();
    assert(
      dialogs.some((texto) => texto.includes('al menos una forma de pago')),
    );
    assert.equal(requests, antes);
    checks += 5;
    await page.evaluate(() => liberarBloqueosReserva());
    await limite(30);
    // Un fallo al obtener el límite tampoco puede habilitar cálculos ni guardado.
    await page.route('**/api/configuracion/cortesias', (route) =>
      route.abort(),
    );
    await page.locator('#nav button').filter({ hasText: 'Recepción' }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('[name=cortesiaPorcentaje]')?.dataset
          .errorLimite,
    );
    await input.fill('20');
    assert.equal(await button.isDisabled(), true);
    assert.equal(
      await page.locator('#resumen_total_reserva').textContent(),
      '—',
    );
    assert.equal(
      await page.locator('#resumen_saldo_pendiente').textContent(),
      '—',
    );
    assert(
      (await page.locator('#errorCortesia').textContent()).includes(
        'No se pudo consultar',
      ),
    );
    checks += 4;
    await page.unroute('**/api/configuracion/cortesias');
    assert.deepEqual(errors, []);
    checks++;
    return checks;
  } catch (error) {
    throw new Error(String(error.message).replaceAll(password, '[OCULTO]'));
  } finally {
    await browser.close();
  }
}
module.exports = { inputBrowserChecks };
