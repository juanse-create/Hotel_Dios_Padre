# Demostración local en Debian 13 — PR #4

## Estado de la demo de Codex

Rama `feature/superadmin-cortesias`, servidor NestJS actualizado en el puerto
interno 3099, usando exclusivamente el fixture sintético conservado. Se preparó
un máximo de 30% y tres habitaciones ficticias libres: `DEMO-101`, `DEMO-102` y
`DEMO-103`, tipo Demostración, tarifa inicial 1000 por noche.

Se comprobó el login de Administrador y Superadministrador, el cambio a 30% por
Superadministrador, el rechazo del cambio de límite por Administrador, una reserva
con 30% (total 1400 y saldo 1300 con anticipo 100) y el rechazo de 31%. La reserva
de comprobación fue eliminada y las tres habitaciones quedaron disponibles.
El preparador se ejecutó dos veces para comprobar que no duplica habitaciones.

**No hay URL compartible disponible en esta sesión.** Se inspeccionaron las
herramientas y capacidades: no hay publicador de vistas web ni control para
compartir puertos. El estado declara escritorio remoto, pero no expone una acción
utilizable aquí ni una URL del sistema. No se creó un túnel público ni un despliegue.
El puerto del contenedor no es accesible automáticamente desde el navegador del
usuario. No confundir el localhost del contenedor con el de tu computadora.

Para probar desde tu navegador, reproduce la demo en tu Debian siguiendo los
pasos de esta guía. No necesitas descargar las credenciales del contenedor:
se generan otras nuevas en tu equipo.

## 1. Dependencias de Debian 13

Ejecutar **en tu equipo de desarrollo**, no en un servidor de producción:

```sh
sudo apt-get update
sudo apt-get install git nodejs npm mariadb-server mariadb-client build-essential python3
sudo systemctl start mariadb
node --version
npm --version
```

El proyecto requiere Node >=20 y <25. Se verificó aquí con Node 24.22.1 y
MariaDB 11.8.6. Si tu versión está fuera de ese rango, instala primero una versión
compatible desde una fuente oficial. No se requiere Docker ni Railway.

Clonar directamente la rama del PR, sin trabajar en main:

```sh
git clone --single-branch --branch feature/superadmin-cortesias https://github.com/BRANDONYMO/Hotel_Dios_Padre.git
cd Hotel_Dios_Padre
git branch --show-current
npm ci --no-audit --no-fund
npm run build
```

Si ya tienes el checkout, úsalo en esa rama preservando tus cambios locales.
Los archivos del contenedor `/workspace/.hotel-dev` no forman parte de Git ni son
necesarios para reproducir la demo en Debian.

## 2. Cuenta MariaDB exclusiva para bases sintéticas

La instalación de Debian suele autenticar root por socket; el fixture usa TCP.
Crear una cuenta **local de desarrollo**, con permisos limitados al prefijo de
las bases sintéticas. No cambiar la autenticación de root ni usar credenciales
reales. Abrir el cliente sin guardar el historial SQL:

```sh
sudo env MYSQL_HISTFILE=/dev/null mariadb
```

En esa consola, sustituir el marcador por una contraseña nueva elegida localmente
(no compartirla en chat ni guardarla en el repositorio):

```sql
CREATE USER 'hotel_demo'@'127.0.0.1' IDENTIFIED BY '<CONTRASEÑA_LOCAL_NUEVA>';
GRANT ALL PRIVILEGES ON `hotel\_cortesias\_test\_%`.* TO 'hotel_demo'@'127.0.0.1';
QUIT;
```

Las barras invertidas hacen que los guiones bajos del prefijo sean literales en
el patrón de permisos. El `%` final permite crear/eliminar únicamente las bases
con ese prefijo. No se otorgan permisos globales ni sobre bases ajenas.
Si esa cuenta ya existe, reutiliza su contraseña y sus permisos; no la elimines.

## 3. Crear el fixture y aplicar la migración

Desde la raíz del repositorio, en Bash:

```sh
install -d -m 700 "$HOME/.local/share/hotel-dios-padre"
export HOTEL_DEMO_STATE="$HOME/.local/share/hotel-dios-padre/demo.json"
read -r -s -p 'Contraseña local de MariaDB hotel_demo: ' DB_PASSWORD
printf '\n'
export DB_PASSWORD
DB_HOST=127.0.0.1 DB_PORT=3306 DB_USERNAME=hotel_demo KEEP_TEST_DB=1 TEST_APP_PORT=3099 TEST_STATE_FILE="$HOTEL_DEMO_STATE" node test/cortesias.integration.cjs
unset DB_PASSWORD
```

La contraseña se introduce sin eco y no aparece en el historial de comandos.
El fixture crea una base nueva `hotel_cortesias_test_<sufijo aleatorio>`, extrae
**solo el esquema** del SQL versionado, inserta filas sintéticas y aplica
`sql/2026_11_superadmin_cortesias.sql`. También verifica la migración repetida,
permisos, límites y cálculos antes de conservar la base. No importa las filas de
usuarios/huéspedes del dump ni utiliza `DB_NAME` del entorno.

`demo.json` debe ser una ruta **nueva**: el script no sobrescribe archivos privados.
Para crear otro fixture, cambia ese nombre y usa un puerto libre. No necesitas
Chromium ni Playwright para estos pasos; el modo de navegador automatizado es
opcional y no se activa con este comando.

En el contenedor de Codex se usa MariaDB en 3307; en Debian normalmente es 3306.
No copies el puerto ni los binarios privados del contenedor a tu instalación.

## 4. Preparar habitaciones e iniciar el hotel

```sh
node test/prepare-cortesias-demo.cjs "$HOTEL_DEMO_STATE"
node test/start-cortesias-local.cjs "$HOTEL_DEMO_STATE"
```

El primer comando verifica ambas cuentas de prueba, deja el máximo en 30% y crea
las habitaciones de demostración si faltan. No borra reservas, no reasigna roles
ni vuelve a poner disponible una habitación que ya utilizaste. Puedes repetirlo
para volver a 30%, pero conserva las reservas y los cambios de habitaciones.

El segundo inicia NestJS usando exclusivamente la base y el JWT local del archivo
privado. Déjalo ejecutándose. Abre en **el navegador de ese mismo equipo Debian**:
`http://127.0.0.1:3099`.

Esta dirección es para tu instalación local; no es una vista previa publicada por
Codex. Si el puerto está ocupado, crea el fixture con otro `TEST_APP_PORT` y usa
ese puerto en el navegador. Para detener NestJS, Ctrl+C en su terminal. Para
reiniciarlo, reutiliza el mismo archivo privado y el mismo comando de arranque.

## 5. Credenciales de los usuarios del hotel

| Cuenta sintética | Tipo de acceso a elegir |
| --- | --- |
| `test_admin` | Administrador |
| `test_super` | Superadministrador |

Las dos cuentas usan la contraseña aleatoria del campo **`testPassword`** del
archivo local indicado por `HOTEL_DEMO_STATE`. Ábrelo en un editor local de
confianza, por ejemplo:

```sh
nano "$HOTEL_DEMO_STATE"
```

Consulta solo `testPassword` para el formulario de acceso. No confundas ese campo
con `dbPassword`, que pertenece a MariaDB. No copies el JSON a GitHub, chat,
capturas ni incidencias: también contiene el secreto JWT y la conexión local.
El archivo se crea con permisos 600, fuera del repositorio, y su directorio tiene
permisos 700. Los scripts nunca imprimen contraseñas o tokens. Cada nuevo fixture
genera sus propias credenciales, sin contraseñas predeterminadas publicadas.

En el entorno actual de Codex, el archivo equivalente está en
`/workspace/.hotel-dev/functional-test.json`; tampoco está en Git. Sin una vista
compartible, utiliza el fixture nuevo de tu propio Debian para entrar desde tu
navegador, en lugar de copiar ese archivo.

## 6. Recorrido manual del máximo 30%

1. Inicia sesión como `test_super`, seleccionando **Superadministrador**.
2. Abre **Cortesías** en el menú lateral. Introduce **30** y pulsa **Guardar límite**.
   Recarga y confirma que permanece en 30%.
3. Cierra sesión y entra como `test_admin`, seleccionando **Administrador**.
   Verás **Reservaciones** y **Recepción**; no aparecerá el menú Cortesías.
4. En **Recepción → Nueva reservación** (o en **Reservaciones**), captura un
   cliente inventado y dos noches futuras. Busca habitaciones y elige `DEMO-101`.
5. Introduce 30% de cortesía y agrega un pago ficticio por 100, por ejemplo una
   transferencia con banco «Banco de prueba» y referencia «DEMO-01». No se realiza
   ninguna operación bancaria: el sistema guarda el registro local del pago.
6. Debes ver subtotal 2000, total neto 1400, pagado 100 y saldo 1300. Guarda la
   reservación y comprueba su tarjeta. Revisa **Reportes** filtrando esas fechas.
7. Intenta 30.01% o 31%: el formulario no permite guardar. La validación por HTTP
   ya confirmó que el backend también rechaza 31% con 400; no depende del campo.
8. Prueba 0% y 10% con otra habitación libre. El Administrador no puede cambiar el
   máximo; aunque manipule el menú o haga PATCH directo, la API devuelve 403.

Se conserva el pago positivo obligatorio incluso con cortesía de 100%, por
instrucción del usuario. El fixture contiene reservas históricas sintéticas de
las pruebas de 0 a 100%; al bajar el máximo a 30% no se recalculan. Sus futuras
ediciones deben cumplir el máximo vigente. Usa las habitaciones `DEMO-*` para
crear tus propios ejemplos sin confundirlos con esa matriz histórica.

## 7. Comprobaciones adicionales y aislamiento

```sh
npm test -- --runInBand
node test/start-cortesias-local.cjs "$HOTEL_DEMO_STATE" --e2e
```

Las suites automatizadas completas y las capturas previas se documentan en
`docs/VALIDACION_FUNCIONAL_SUPERADMIN.md`. El preparador y el arranque rechazan
hosts remotos y nombres de bases fuera de `hotel_cortesias_test_*`. No ejecutan
migraciones en otras bases, no llaman a Railway y no hacen Git merge ni despliegues.
Toda la conexión de aplicación se obtiene del fixture, no de una URL de producción.

No se alteró main ni se accedió a una base de producción para preparar esta demo.
