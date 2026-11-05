const { readFileSync } = require('node:fs');

// Solo DDL del archivo versionado: nunca importa sus filas de huéspedes/usuarios.
async function syntheticSchema(db) {
  const dump = readFileSync('sql-v2-sept-dic/hotel_dios_padre.sql', 'utf8');
  const statements = dump.match(/^(?:CREATE TABLE|ALTER TABLE)[\s\S]*?;\s*$/gm);
  if (!statements?.length) throw Error('No se encontró el esquema SQL');
  await db.query(statements.join('\n'));
  for (const rol of ['Administrador', 'Camarista', 'Taquilla']) {
    await db.execute('INSERT INTO roles (nombre, activo) VALUES (?, 1)', [rol]);
  }
  for (const estado of [
    'Disponible',
    'En proceso de reservación',
    'Reservada',
    'Ocupada',
    'Pendiente de limpieza',
    'Sucia',
    'En proceso',
    'Limpia',
    'Fuera de servicio',
  ]) {
    await db.execute('INSERT INTO estados_habitacion (nombre) VALUES (?)', [
      estado,
    ]);
  }
  const [guest] = await db.execute(
    'INSERT INTO huespedes (nombre, apellido_paterno, telefono) VALUES (?, ?, ?)',
    ['Cliente Sintético', 'Prueba', '0000000000'],
  );
  await db.execute(
    "INSERT INTO reservaciones (folio, huesped_id, fecha_inicio, fecha_fin, adultos, menores, estado) VALUES ('TEST-HISTORICO', ?, '2098-01-01', '2098-01-02', 1, 0, 'Cancelada')",
    [guest.insertId],
  );
}
module.exports = { syntheticSchema };
