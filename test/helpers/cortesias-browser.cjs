const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');

async function browserChecks({ baseURL, password }) {
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
    for (const [key, rol] of [
      ['admin', 'Administrador'],
      ['super', 'Superadministrador'],
    ]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      // Aislar la prueba local; los iconos CDN no son necesarios para los permisos.
      await context.route('**/*', (route) =>
        route.request().url().startsWith(baseURL)
          ? route.continue()
          : route.abort(),
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('dialog', (dialog) => dialog.accept());
      await page.goto(baseURL);
      const options = await page.locator('#tipo option').allTextContents();
      if (!options.includes(rol)) {
        await page.locator('#usuario').fill(`test_${key}`);
        await page.locator('#password').fill(password);
        await page.locator('button[type=submit]').click();
        await page
          .locator('#error')
          .filter({ hasText: 'no corresponde' })
          .waitFor();
        await page.locator('#password').fill('');
        await page.screenshot({
          path: `${evidence}/error-login-superadministrador.png`,
          fullPage: true,
        });
        throw Error(
          'ERROR FUNCIONAL: el selector de acceso no ofrece Superadministrador; login web rechazado.',
        );
      }
      await page.locator('#tipo').selectOption(rol);
      await page.locator('#usuario').fill(`test_${key}`);
      await page.locator('#password').fill(password);
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/admin.html');
      await page.locator('.dashboard-hero').waitFor();
      assert.equal(
        await page
          .locator('#nav button')
          .filter({ hasText: 'Cortesías' })
          .count(),
        key === 'super' ? 1 : 0,
      );
      await page.screenshot({
        path: `${evidence}/${key}-panel.png`,
        fullPage: true,
      });
      checks += 2;
      if (key === 'super') {
        await page
          .locator('#nav button')
          .filter({ hasText: 'Cortesías' })
          .click();
        await page.locator('#cortesiasForm input').fill('30');
        const saved = page.waitForResponse(
          (r) =>
            r.url().endsWith('/api/configuracion/cortesias') &&
            r.request().method() === 'PATCH',
        );
        await page.locator('#cortesiasForm button').click();
        assert.equal((await saved).status(), 200);
        await page.screenshot({
          path: `${evidence}/super-limite.png`,
          fullPage: true,
        });
        checks++;
      }
      await page
        .locator('#nav button')
        .filter({ hasText: 'Reservaciones' })
        .click();
      await page.locator('[name=cortesiaPorcentaje]').waitFor();
      await page.waitForFunction(() =>
        document.getElementById('limiteCortesia')?.textContent.includes('%'),
      );
      assert(
        (await page.locator('#content').textContent()).includes(
          'Cortesía aplicada:',
        ),
      );
      await page.screenshot({
        path: `${evidence}/${key}-reservaciones.png`,
        fullPage: true,
      });
      await page.locator('#nav button').filter({ hasText: 'Usuarios' }).click();
      await page.locator('#usuarioForm').waitFor({ state: 'attached' });
      const roles = await page
        .locator('#usuarioForm [name=rolId] option')
        .allTextContents();
      assert.equal(roles.includes('Superadministrador'), key === 'super');
      checks++;
      await page
        .locator('#nav button')
        .filter({ hasText: 'Recepción' })
        .click();
      await page.locator('[name=cortesiaPorcentaje]').waitFor();
      checks++;
      if (key === 'admin') {
        const denied = await page.evaluate(async () => {
          const response = await fetch('/api/configuracion/cortesias', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + localStorage.getItem('token'),
            },
            body: JSON.stringify({ maximoPorcentaje: 100 }),
          });
          return response.status;
        });
        assert.equal(denied, 403);
        await page.locator('[name=nombre]').fill('Cliente');
        await page.locator('[name=apellidoPaterno]').fill('Sintético');
        await page.locator('[name=telefono]').fill('0000000000');
        await page.locator('[name=fechaInicio]').fill('2100-01-01');
        await page.locator('[name=fechaFin]').fill('2100-01-03');
        await page.locator('[name=cortesiaPorcentaje]').fill('30');
        await page
          .locator('button')
          .filter({ hasText: 'Buscar habitaciones' })
          .click();
        const room = page
          .locator('.available-room')
          .filter({ hasText: 'TEST-UI' })
          .locator('input');
        const blocked = page.waitForResponse(
          (r) =>
            r.url().includes('/reservaciones/bloqueo/') &&
            r.request().method() === 'POST',
        );
        await room.check();
        assert.equal((await blocked).status(), 201);
        await page.waitForFunction(
          () =>
            document.getElementById('resumen_total_reserva').textContent ===
            '$1400.00',
        );
        assert.equal(
          await page.locator('#pago_total_manual').inputValue(),
          '2000.00',
        );
        assert.equal(
          await page.locator('#pago_total_manual').getAttribute('readonly'),
          '',
        );
        checks += 2;
        await page
          .locator('#pago_metodo')
          .selectOption('Transferencia bancaria');
        await page.locator('#pago_importe').fill('100');
        await page.locator('#pago_banco').fill('Banco de prueba');
        await page.locator('#pago_referencia').fill('TEST-UI');
        await page
          .locator('button')
          .filter({ hasText: 'Agregar pago a la reservación' })
          .click();
        assert.equal(
          await page.locator('#resumen_saldo_pendiente').textContent(),
          '$1300.00',
        );
        await page.locator('#resumen_total_reserva').scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${evidence}/admin-cortesia-30.png`,
          fullPage: true,
        });
        const saved = page.waitForResponse(
          (r) =>
            r.url().endsWith('/api/reservaciones') &&
            r.request().method() === 'POST',
        );
        await page.locator('button[onclick="guardarReserva()"]').click();
        const result = await saved;
        assert.equal(result.status(), 201);
        const reservation = await result.json();
        assert.equal(Number(reservation.cortesiaPorcentaje), 30);
        checks += 5;
      }
      assert.deepEqual(errors, []);
      checks += 2;
      await context.close();
    }
    return checks;
  } catch (error) {
    throw new Error(String(error.message).replaceAll(password, '[OCULTO]'));
  } finally {
    await browser.close();
  }
}
module.exports = { browserChecks };
