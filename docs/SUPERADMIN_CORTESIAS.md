# Superadministrador y cortesías

## Flujo y permisos

La versión anterior no contiene cortesías, descuentos ni autorizaciones de descuentos.
La tabla `reservacion_pagos` del dump no se utiliza en el código activo: el servicio usa
`pagos`. Se conserva ese flujo, las tarifas guardadas por habitación, los pagos y los
estados de recepción. La cortesía no se registra como pago ni altera la tarifa.

`Superadministrador` hereda los endpoints que admiten `Administrador` mediante
`RolesGuard`. Entra en el mismo panel y dispone de la sección **Cortesías**.
Ambos pueden aplicar cortesías en Reservaciones y Recepción, sujetas al límite.
Solo el Superadministrador puede modificarlo:

- `GET /api/configuracion/cortesias`: devuelve `{ "maximoPorcentaje": 20 }`.
- `PATCH /api/configuracion/cortesias`: recibe `{ "maximoPorcentaje": 20 }`.
- Crear/editar reservación: `cortesiaPorcentaje`, número JSON entre 0 y 100,
  con hasta dos decimales. No acepta cadenas, null, negativos ni valores no finitos.

El límite inicial es **0%**. Si falta configuración, se rechaza la operación.
La validación comparte un bloqueo de fila con la actualización del límite y se
realiza en la transacción que guarda la reservación. Cambiar el límite no cambia
reservaciones anteriores; al editarlas se exige el límite vigente. Omitir el campo
al crear equivale a 0%; omitirlo al editar conserva el porcentaje guardado, sujeto
al límite vigente.

Total neto = redondear(tarifas × noches × (1 − cortesía / 100), 2).
El saldo usa ese total menos los pagos. Los reportes descuentan la cortesía de los
importes de estancia; no cambian a contabilidad de caja. Se conserva la regla actual
de al menos un pago registrado, incluso si se configura un límite de 100%; no se
introduce una excepción de reservaciones sin pago.

El servidor consulta usuario y rol vigentes en cada petición autenticada. Una
revocación de rol o desactivación invalida los privilegios de tokens anteriores.
Un Administrador no puede asignar el rol privilegiado ni cambiar datos, contraseña,
rol o estado de una cuenta Superadministrador. El selector de roles lo oculta para
administradores; manipular la petición tampoco permite otorgarlo.

## Migración y primer Superadministrador

1. Hacer respaldo y probar primero en una copia de la BD real. Requiere MySQL 8.0.16+
   para que se ejecuten los CHECK; las validaciones de aplicación también son obligatorias.
2. Con la aplicación detenida durante la ventana de mantenimiento, seleccionar la
   base correcta y ejecutar `sql/2026_11_superadmin_cortesias.sql` **antes** del código
   nuevo. Es aditiva y reejecutable; no elimina filas ni cambia roles de usuarios.
   El ALTER puede bloquear la tabla: evaluar tamaño/tiempo en la copia real.
3. Un operador con acceso directo a MySQL debe revisar la identidad de la cuenta
   que será el primer Superadministrador y asignarla explícitamente. No hay endpoint
   de bootstrap ni autoascenso del Administrador. Ejemplo manual, sustituyendo el ID
   después de revisar la cuenta (no ejecutar literalmente el marcador):

   ```sql
   START TRANSACTION;
   SELECT id, usuario, rol_id FROM usuarios WHERE id = <ID_VERIFICADO> FOR UPDATE;
   UPDATE usuarios
   SET rol_id = (SELECT id FROM roles WHERE nombre = 'Superadministrador' AND activo = 1)
   WHERE id = <ID_VERIFICADO> AND activo = 1;
   COMMIT;
   ```

4. Iniciar sesión nuevamente para actualizar también los menús del navegador.
   Los Superadministradores posteriores se crean/asignan desde Usuarios por una
   cuenta Superadministrador existente.

No hay rollback destructivo automático: si se revierte el código, conservar las
columnas, configuración y roles hasta planificar el tratamiento de cortesías ya
registradas. La versión anterior no descuenta cortesías en sus totales; no usarla
para operar reservas con cortesía sin un plan de reversión contable.

## Verificación

```sh
npm ci --no-audit --no-fund
npm run build
npm test -- --runInBand
node --check public/admin.js
node --check public/app.js
DB_HOST=127.0.0.1 DB_PORT=3307 DB_USERNAME=root node test/cortesias.integration.cjs
```

La integración necesita un servidor de pruebas MySQL/MariaDB con permiso de crear
bases. Crea una BD aleatoria `hotel_cortesias_test_*`, crea únicamente el esquema del dump versionado y datos sintéticos,
aplica la migración y la elimina al finalizar. Nunca utiliza `DB_NAME`. Inicia Nest
en el puerto `TEST_APP_PORT` (3099 por defecto). No dirigirla a producción.
Prueba HTTP/JWT real, revocación, asignación de roles, entradas inválidas, límite
inclusive, creación/edición, compatibilidad sin campo, totales, pagos y reportes.

Validado localmente con Node 24 y MariaDB 11.8.6: build, 56 pruebas unitarias,
2 pruebas e2e y 159 comprobaciones de integración con Chromium. El test preexistente de disponibilidad tenía
una petición sin pagos y fallaba antes de evaluar disponibilidad; se completó su
fixture con un pago válido sin retirar la aserción de disponibilidad.

No se dispone de la BD de producción ni se ejecuta esta migración en Railway.
Pendiente validar en una copia MySQL de producción, sus diferencias de esquema,
volumen, SQL modes y cuentas reales. La validación visual en Chromium y sus capturas se documentan en
`docs/VALIDACION_FUNCIONAL_SUPERADMIN.md`. La suite e2e antigua se actualizó para
probar el formulario real y su arranque con NestFactory.

## Archivos de esta implementación

- `docs/PR_SUPERADMIN_CORTESIAS.md`
- `docs/SUPERADMIN_CORTESIAS.md`
- `public/admin.html`
- `public/admin.js`
- `public/app.js`
- `sql/2026_11_superadmin_cortesias.sql`
- `src/auth/constants/roles.ts`
- `src/auth/jwt.strategy.spec.ts`
- `src/auth/jwt.strategy.ts`
- `src/common/guards/roles.guard.ts`
- `src/reportes/reportes.controller.ts`
- `src/reservaciones/cortesias.controller.ts`
- `src/reservaciones/cortesias.spec.ts`
- `src/reservaciones/cortesias.ts`
- `src/reservaciones/entities/reservacion.entity.ts`
- `src/reservaciones/reservaciones.module.ts`
- `src/reservaciones/reservaciones.service.spec.ts`
- `src/reservaciones/reservaciones.service.ts`
- `src/usuarios/usuarios.controller.ts`
- `src/usuarios/usuarios.service.spec.ts`
- `src/usuarios/usuarios.service.ts`
- `test/cortesias.integration.cjs`
