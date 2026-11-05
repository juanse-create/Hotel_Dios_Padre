// Prepara únicamente fixtures sintéticos conservados por cortesias.integration.cjs.
// No imprime contraseñas ni tokens y no borra reservas existentes.
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
const mysql = require('mysql2/promise');

(async () => {
  const file = process.argv[2];
  if (!file || (statSync(file).mode & 0o077) !== 0)
    throw Error('Indica el archivo privado del fixture, con permisos 600');
  const config = JSON.parse(readFileSync(file, 'utf8'));
  if (
    !['127.0.0.1', 'localhost'].includes(config.host) ||
    !/^hotel_cortesias_test_[a-f0-9]{12}$/.test(config.database)
  )
    throw Error(
      'Solo se admiten fixtures sintéticos locales hotel_cortesias_test_*',
    );
  const db = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.dbPassword,
    database: config.database,
  });
  try {
    const [users] = await db.query(
      "SELECT u.usuario, u.activo, r.nombre rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.usuario IN ('test_admin','test_super')",
    );
    assert(
      users.some(
        (u) =>
          u.usuario === 'test_admin' && u.activo && u.rol === 'Administrador',
      ),
      'Falta Administrador sintético activo',
    );
    assert(
      users.some(
        (u) =>
          u.usuario === 'test_super' &&
          u.activo &&
          u.rol === 'Superadministrador',
      ),
      'Falta Superadministrador sintético activo',
    );
    await db.beginTransaction();
    await db.execute(
      'UPDATE configuracion_cortesias SET maximo_porcentaje=30 WHERE id=1',
    );
    await db.execute(
      "INSERT INTO tipos_habitacion (nombre, capacidad, camas, precio, activo) SELECT 'Demostración', 2, 1, 1000, 1 WHERE NOT EXISTS (SELECT 1 FROM tipos_habitacion WHERE nombre='Demostración')",
    );
    for (const numero of ['DEMO-101', 'DEMO-102', 'DEMO-103']) {
      await db.execute(
        "INSERT INTO habitaciones (numero, piso, tipo_id, estado_id, activa) SELECT ?, 1, t.id, e.id, 1 FROM tipos_habitacion t JOIN estados_habitacion e ON e.nombre='Disponible' WHERE t.nombre='Demostración' AND NOT EXISTS (SELECT 1 FROM habitaciones WHERE numero=?) LIMIT 1",
        [numero, numero],
      );
    }
    const [rooms] = await db.query(
      "SELECT h.numero FROM habitaciones h JOIN estados_habitacion e ON e.id=h.estado_id WHERE h.numero IN ('DEMO-101','DEMO-102','DEMO-103') AND e.nombre='Disponible' AND h.activa=1",
    );
    const [configRows] = await db.query(
      'SELECT maximo_porcentaje FROM configuracion_cortesias WHERE id=1',
    );
    assert.equal(Number(configRows[0]?.maximo_porcentaje), 30);
    await db.commit();
    console.log(
      'OK: fixture sintético local, test_admin y test_super activos; máximo 30%.',
    );
    console.log(
      `Habitaciones de demostración libres: ${rooms.length}. Tarifa nueva: 1000 por noche.`,
    );
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
