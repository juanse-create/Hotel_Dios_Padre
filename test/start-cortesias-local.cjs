// Lee configuración de prueba privada sin imprimir contraseñas ni JWT.
const { readFileSync, statSync } = require('node:fs');
const { spawn } = require('node:child_process');
const file = process.argv[2];
if (!file) throw Error('Indica el archivo privado generado con KEEP_TEST_DB=1');
if ((statSync(file).mode & 0o077) !== 0)
  throw Error('El archivo privado debe tener permisos 600');
const config = JSON.parse(readFileSync(file, 'utf8'));
if (
  !['127.0.0.1', 'localhost'].includes(config.host) ||
  !/^hotel_cortesias_test_[a-f0-9]{12}$/.test(config.database)
)
  throw Error('Solo se admiten fixtures locales hotel_cortesias_test_*');
const e2e = process.argv[3] === '--e2e';
const server = spawn(
  e2e ? 'npm' : process.execPath,
  e2e ? ['run', 'test:e2e', '--', '--runInBand'] : ['dist/main.js'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DB_HOST: config.host,
      DB_PORT: String(config.port),
      DB_USERNAME: config.user,
      DB_PASSWORD: config.dbPassword,
      DB_NAME: config.database,
      DB_SSL: 'false',
      JWT_SECRET: config.secret,
      PORT: String(config.appPort),
    },
  },
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.kill(signal));
server.on('exit', (code) => {
  process.exitCode = code || 0;
});
