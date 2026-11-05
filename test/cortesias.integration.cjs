/* Requiere un servidor MySQL de pruebas con permiso CREATE DATABASE.
 * Crea y elimina exclusivamente una BD aleatoria hotel_cortesias_test_*.
 * npm run build && DB_HOST=127.0.0.1 DB_PORT=3307 DB_USERNAME=root node test/cortesias.integration.cjs
 */
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync } = require('node:fs');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { syntheticSchema } = require('./helpers/cortesias-fixture.cjs');

(async () => {
  const name = 'hotel_cortesias_test_' + randomBytes(6).toString('hex');
  const port = Number(process.env.TEST_APP_PORT || 3099);
  const secret = randomBytes(32).toString('hex');
  const host = process.env.DB_HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost'].includes(host))
    throw Error('Esta prueba solo admite una BD local');
  const db = await mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  let child;
  let created = false;
  let retained = false;
  let logs = '';
  let checks = 0;
  async function api(path, token, method = 'GET', body, status = 200) {
    const result = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await result.json();
    assert.equal(
      result.status,
      status,
      `${method} ${path}: ${JSON.stringify(data.message || 'estado inesperado')}`,
    );
    checks++;
    return data;
  }
  try {
    await db.query(`CREATE DATABASE \`${name}\``);
    created = true;
    await db.query(`USE \`${name}\``);
    await syntheticSchema(db);
    const [before] = await db.query(
      'SELECT id, folio FROM reservaciones ORDER BY id',
    );
    await db.query(
      readFileSync('sql/2026_11_superadmin_cortesias.sql', 'utf8'),
    );
    const [after] = await db.query(
      'SELECT id, folio FROM reservaciones ORDER BY id',
    );
    assert.deepEqual(after, before);
    checks++;
    const [historical] = await db.query(
      'SELECT cortesia_porcentaje FROM reservaciones',
    );
    assert(historical.every((r) => Number(r.cortesia_porcentaje) === 0));
    checks++;
    const [roles] = await db.query('SELECT id, nombre FROM roles');
    const roleId = Object.fromEntries(roles.map((r) => [r.nombre, r.id]));
    const accounts = {};
    const password = randomBytes(16).toString('hex');
    for (const [key, rol] of Object.entries({
      admin: 'Administrador',
      super: 'Superadministrador',
      taquilla: 'Taquilla',
      camarista: 'Camarista',
    })) {
      const [result] = await db.execute(
        'INSERT INTO usuarios (nombre, usuario, password, rol_id, activo) VALUES (?, ?, ?, ?, 1)',
        ['Prueba', `test_${key}`, await bcrypt.hash(password, 4), roleId[rol]],
      );
      accounts[key] = {
        id: result.insertId,
        token: jwt.sign({ sub: result.insertId, rol }, secret),
      };
    }
    child = spawn(process.execPath, ['dist/main.js'], {
      env: {
        ...process.env,
        DB_HOST: process.env.DB_HOST || '127.0.0.1',
        DB_PORT: String(process.env.DB_PORT || 3307),
        DB_USERNAME: process.env.DB_USERNAME || 'root',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        DB_NAME: name,
        DB_SSL: 'false',
        JWT_SECRET: secret,
        PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (data) => {
      logs += data;
    });
    child.stderr.on('data', (data) => {
      logs += data;
    });
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (child.exitCode !== null) throw Error('Nest terminó: ' + logs);
      try {
        const r = await fetch(
          `http://127.0.0.1:${port}/api/configuracion/cortesias`,
        );
        if (r.status === 401) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(ready, 'Nest no inició: ' + logs);
    const admin = accounts.admin.token,
      superadmin = accounts.super.token;
    await api('/configuracion/cortesias', null, 'GET', undefined, 401);
    assert.equal(
      (await api('/configuracion/cortesias', admin)).maximoPorcentaje,
      0,
    );
    await api(
      '/configuracion/cortesias',
      admin,
      'PATCH',
      { maximoPorcentaje: 50 },
      403,
    );
    for (const key of ['camarista', 'taquilla']) {
      await api(
        '/configuracion/cortesias',
        accounts[key].token,
        'PATCH',
        { maximoPorcentaje: 50 },
        403,
      );
      await api('/reservaciones', accounts[key].token, 'GET', undefined, 403);
    }
    for (const value of [-1, 100.01, null, '20', 0.001])
      await api(
        '/configuracion/cortesias',
        superadmin,
        'PATCH',
        { maximoPorcentaje: value },
        400,
      );
    await api('/configuracion/cortesias', superadmin, 'PATCH', {
      maximoPorcentaje: 20,
    });
    await db.query(
      readFileSync('sql/2026_11_superadmin_cortesias.sql', 'utf8'),
    );
    assert.equal(
      (await api('/configuracion/cortesias', admin)).maximoPorcentaje,
      20,
    );
    await api('/reportes/dashboard', superadmin);
    await api('/habitaciones', superadmin);
    const login = await api(
      '/auth/login',
      null,
      'POST',
      { usuario: 'test_super', password },
      200,
    );
    assert.equal(login.usuario.rol, 'Superadministrador');
    checks++;
    const userBody = {
      nombre: 'Prueba',
      usuario: 'otro_super',
      password,
      rolId: roleId.Superadministrador,
    };
    await api('/usuarios', admin, 'POST', userBody, 403);
    await api(
      `/usuarios/${accounts.admin.id}`,
      admin,
      'PATCH',
      { rolId: roleId.Superadministrador },
      403,
    );
    await api(
      `/usuarios/${accounts.super.id}`,
      admin,
      'PATCH',
      { password },
      403,
    );
    await api(`/usuarios/${accounts.super.id}/estado`, admin, 'PATCH', {}, 403);
    await api(
      `/usuarios/${accounts.super.id}`,
      admin,
      'DELETE',
      undefined,
      403,
    );
    await api('/usuarios', superadmin, 'POST', userBody, 201);
    const [type] = await db.execute(
      'INSERT INTO tipos_habitacion (nombre, capacidad, camas, precio, activo) VALUES (?, 2, 1, 1000, 1)',
      ['Prueba'],
    );
    await db.execute(
      "INSERT INTO habitaciones (numero, piso, tipo_id, estado_id, activa) SELECT 'TEST-01', 1, ?, id, 1 FROM estados_habitacion WHERE nombre='Disponible' LIMIT 1",
      [type.insertId],
    );
    const [rooms] = await db.query(
      "SELECT h.id, th.precio FROM habitaciones h JOIN tipos_habitacion th ON th.id=h.tipo_id JOIN estados_habitacion e ON e.id=h.estado_id WHERE h.activa=1 AND e.nombre='Disponible' AND th.precio>0 LIMIT 1",
    );
    assert(rooms.length, 'Se necesita una habitación disponible en el dump');
    const [guests] = await db.query('SELECT id FROM huespedes LIMIT 1');
    const payload = {
      huespedId: guests[0].id,
      habitacionIds: [rooms[0].id],
      fechaInicio: '2099-11-01',
      fechaFin: '2099-11-03',
      adultos: 1,
      menores: 0,
      cortesiaPorcentaje: 20,
      pagos: [
        {
          metodo_pago: 'transferencia',
          importe: 100,
          banco: 'Prueba',
          fecha_pago: '2099-11-01',
          referencia: 'TEST',
        },
      ],
    };
    for (const value of [20.01, 44444444, -1, 101, null, '20', 0.001])
      await api(
        '/reservaciones',
        admin,
        'POST',
        { ...payload, cortesiaPorcentaje: value },
        400,
      );
    const reservation = await api(
      '/reservaciones',
      admin,
      'POST',
      payload,
      201,
    );
    const rows = await api('/reservaciones', admin);
    const saved = rows.find((r) => r.id === reservation.id);
    const expected = Math.round(Number(rooms[0].precio) * 2 * 0.8 * 100) / 100;
    assert.equal(saved.total_reservacion, expected);
    assert.equal(saved.total_pagado, 100);
    assert.equal(saved.saldo_pendiente, Math.max(0, expected - 100));
    checks += 3;
    await api(
      `/reservaciones/${reservation.id}`,
      admin,
      'PATCH',
      { ...payload, cortesiaPorcentaje: 20.01 },
      400,
    );
    await api('/configuracion/cortesias', superadmin, 'PATCH', {
      maximoPorcentaje: 10,
    });
    const unchanged = (await api('/reservaciones', admin)).find(
      (r) => r.id === reservation.id,
    );
    assert.equal(unchanged.total_reservacion, expected);
    checks++;
    await api(`/reservaciones/${reservation.id}`, admin, 'PATCH', payload, 400);
    await api('/configuracion/cortesias', superadmin, 'PATCH', {
      maximoPorcentaje: 20,
    });
    const { cortesiaPorcentaje, ...legacyPayload } = payload;
    await api(
      `/reservaciones/${reservation.id}`,
      admin,
      'PATCH',
      legacyPayload,
    );
    const preserved = (await api('/reservaciones', admin)).find(
      (r) => r.id === reservation.id,
    );
    assert.equal(Number(preserved.cortesia_porcentaje), 20);
    checks++;
    await api(`/reservaciones/${reservation.id}`, admin, 'PATCH', {
      ...payload,
      cortesiaPorcentaje: 0,
    });
    const restored = (await api('/reservaciones', admin)).find(
      (r) => r.id === reservation.id,
    );
    assert.equal(restored.total_reservacion, Number(rooms[0].precio) * 2);
    checks++;
    await api('/configuracion/cortesias', superadmin, 'PATCH', {
      maximoPorcentaje: 10,
    });
    await api(`/reservaciones/${reservation.id}`, admin, 'PATCH', payload, 400);
    const legacy = await api(
      '/reservaciones',
      admin,
      'POST',
      { ...legacyPayload, fechaInicio: '2099-11-10', fechaFin: '2099-11-12' },
      201,
    );
    assert.equal(Number(legacy.cortesiaPorcentaje), 0);
    checks++;
    await api(
      '/reportes/tipos-habitacion?inicio=2099-11-01&fin=2099-11-03',
      superadmin,
    );
    await api(
      '/reportes/ingresos-por-dia?inicio=2099-11-01&fin=2099-11-03',
      superadmin,
    );
    const matrix = [];
    let browserCount = 0;
    for (const [index, porcentaje] of [0, 10, 30, 50, 100].entries()) {
      await api('/configuracion/cortesias', superadmin, 'PATCH', {
        maximoPorcentaje: porcentaje,
      });
      await api(
        '/configuracion/cortesias',
        admin,
        'PATCH',
        { maximoPorcentaje: porcentaje },
        403,
      );
      const day = 1 + index * 4;
      const inicio = `2099-12-${String(day).padStart(2, '0')}`;
      const fin = `2099-12-${String(day + 2).padStart(2, '0')}`;
      const input = {
        ...payload,
        fechaInicio: inicio,
        fechaFin: fin,
        cortesiaPorcentaje: porcentaje,
      };
      const createdReservation = await api(
        '/reservaciones',
        admin,
        'POST',
        input,
        201,
      );
      const row = (await api('/reservaciones', admin)).find(
        (r) => r.id === createdReservation.id,
      );
      const neto = 2000 * (1 - porcentaje / 100);
      assert.equal(row.total_reservacion, neto);
      assert.equal(row.total_pagado, 100);
      assert.equal(row.saldo_pendiente, Math.max(0, neto - 100));
      const tipos = await api(
        `/reportes/tipos-habitacion?inicio=${inicio}&fin=${fin}`,
        superadmin,
      );
      assert.equal(
        tipos.reduce((total, r) => total + Number(r.ganancias), 0),
        neto,
      );
      const dias = await api(
        `/reportes/ingresos-por-dia?inicio=${inicio}&fin=${fin}`,
        superadmin,
      );
      assert.equal(
        dias.reduce((total, r) => total + Number(r.ganancias), 0),
        neto,
      );
      checks += 5;
      await api(
        `/reservaciones/${createdReservation.id}`,
        admin,
        'PATCH',
        { ...input, cortesiaPorcentaje: porcentaje + 0.01 },
        400,
      );
      if (porcentaje === 100) {
        await api(
          '/reservaciones',
          admin,
          'POST',
          { ...input, pagos: [] },
          400,
        );
        const { pagos, ...sinPagos } = input;
        await api('/reservaciones', admin, 'POST', sinPagos, 400);
        for (const importe of [0, -1]) {
          await api(
            '/reservaciones',
            admin,
            'POST',
            { ...input, pagos: [{ ...input.pagos[0], importe }] },
            400,
          );
        }
      }
      matrix.push({
        porcentaje,
        bruto: 2000,
        neto,
        pagado: 100,
        saldo: row.saldo_pendiente,
        reportes: neto,
        resultado: 'APROBADO',
      });
    }
    for (const value of [-1, 44444444, 101, null, '', '30', true, {}, [], 0.001]) {
      await api(
        '/configuracion/cortesias',
        superadmin,
        'PATCH',
        { maximoPorcentaje: value },
        400,
      );
      await api(
        `/reservaciones/${reservation.id}`,
        admin,
        'PATCH',
        { ...payload, cortesiaPorcentaje: value },
        400,
      );
    }
    if (process.env.BROWSER_TEST === '1') {
      await db.execute(
        "INSERT INTO habitaciones (numero, piso, tipo_id, estado_id, activa) SELECT 'TEST-UI', 1, ?, id, 1 FROM estados_habitacion WHERE nombre='Disponible' LIMIT 1",
        [type.insertId],
      );
      const { browserChecks } = require('./helpers/cortesias-browser.cjs');
      browserCount = await browserChecks({
        baseURL: `http://127.0.0.1:${port}`,
        password,
        matrix,
      });
      await db.execute(
        "INSERT INTO habitaciones (numero, piso, tipo_id, estado_id, activa) SELECT 'TEST-REG', 1, ?, id, 1 FROM estados_habitacion WHERE nombre='Disponible' LIMIT 1",
        [type.insertId],
      );
      const {
        inputBrowserChecks,
      } = require('./helpers/cortesias-input-browser.cjs');
      browserCount += await inputBrowserChecks({
        baseURL: `http://127.0.0.1:${port}`,
        password,
      });
      checks += browserCount;
    }
    console.log('Matriz funcional: ' + JSON.stringify(matrix));
    await db.execute('UPDATE usuarios SET rol_id=? WHERE id=?', [
      roleId.Administrador,
      accounts.super.id,
    ]);
    await api(
      '/configuracion/cortesias',
      superadmin,
      'PATCH',
      { maximoPorcentaje: 50 },
      403,
    );
    await db.execute('UPDATE usuarios SET activo=0 WHERE id=?', [
      accounts.admin.id,
    ]);
    await api('/configuracion/cortesias', admin, 'GET', undefined, 401);
    const [version] = await db.query('SELECT VERSION() version');
    if (process.env.RESULTS_FILE)
      writeFileSync(
        process.env.RESULTS_FILE,
        JSON.stringify(
          {
            resultado: 'APROBADO',
            node: process.version,
            database: version[0].version,
            chromium: process.env.BROWSER_TEST === '1',
            comprobaciones: checks,
            navegador: browserCount,
            datos: 'Solo sintéticos; esquema sin filas del dump',
            matriz: matrix,
          },
          null,
          2,
        ) + '\n',
      );
    if (process.env.KEEP_TEST_DB === '1') {
      // Restaurar los usuarios tras las pruebas de revocación para la sesión manual.
      await db.execute('UPDATE usuarios SET rol_id=?, activo=1 WHERE id=?', [
        roleId.Superadministrador,
        accounts.super.id,
      ]);
      await db.execute('UPDATE usuarios SET activo=1 WHERE id=?', [
        accounts.admin.id,
      ]);
      await db.execute(
        'UPDATE configuracion_cortesias SET maximo_porcentaje=30 WHERE id=1',
      );
      const stateFile = process.env.TEST_STATE_FILE || `/tmp/${name}.json`;
      writeFileSync(
        stateFile,
        JSON.stringify({
          host,
          port: Number(process.env.DB_PORT || 3307),
          user: process.env.DB_USERNAME || 'root',
          dbPassword: process.env.DB_PASSWORD || '',
          database: name,
          appPort: port,
          secret,
          testPassword: password,
          users: ['test_admin', 'test_super'],
        }),
        { mode: 0o600, flag: 'wx' },
      );
      retained = true;
      console.log(
        'Fixture manual conservado. Archivo privado (no compartir): ' +
          stateFile,
      );
    }
    console.log(
      `OK: ${checks} comprobaciones de migración, HTTP/JWT, permisos, límites, reservaciones, pagos y reportes.`,
    );
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
    if (created && !retained)
      await db.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await db.end();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
