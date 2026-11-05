## Problema y cambio

El sistema carecía de cortesías y de un rol que controlara su autorización. Agrega Superadministrador con acceso al panel y endpoints administrativos existentes, y un límite de cortesía persistido en MySQL que solo ese rol puede modificar. Administrador puede aplicar cortesías dentro del límite, validado transaccionalmente por el backend.

Integra el porcentaje en creación/edición, totales, saldos y reportes sin representar cortesías como pagos. Protege creación/asignación y gestión de cuentas privilegiadas; consulta el rol vigente para evitar privilegios retenidos por JWT antiguos.

## Migración y operación

Aplicar `sql/2026_11_superadmin_cortesias.sql` antes del código nuevo, tras respaldo y ensayo en una copia. Es aditiva y reejecutable; inicia el límite en 0% y no asciende usuarios. Un operador MySQL debe asignar el primer Superadministrador a una cuenta verificada. Instrucciones y limitaciones en `docs/SUPERADMIN_CORTESIAS.md`.

Conserva la regla existente de pago obligatorio. Un límite menor no recalcula reservas guardadas; sus futuras ediciones deben cumplirlo.

## Validación

- `npm run build`
- `npm test -- --runInBand`: 56 pruebas aprobadas.
- `BROWSER_TEST=1 DB_PORT=3307 node test/cortesias.integration.cjs`: 159 comprobaciones aprobadas con MariaDB 11.8.6 local, incluyendo migración repetida, peticiones HTTP/JWT reales y Chromium (`BROWSER_TEST=1`).
- Suite e2e: 2 pruebas aprobadas usando una BD sintética local.
- `node --check public/admin.js` y `node --check public/app.js`
- ESLint dirigido: sin errores ni advertencias en los archivos de permisos, autenticación, configuración y usuarios.

Se corrigió el selector de login que impedía el acceso web del Superadministrador. Capturas e informe en `docs/VALIDACION_FUNCIONAL_SUPERADMIN.md`. Sin acceso a producción: pendiente ensayo contra una copia MySQL real. Sin merge ni despliegue en Railway.

## Regresión de cortesía inválida

Validación visual inmediata antes de calcular; los valores inválidos muestran un error, bloquean el guardado y dejan descuento, neto y saldo sin importe en Reservaciones/Recepción y sus editores. También se evita heredar pagos entre formularios nuevos. El backend mantiene sus controles independientes.

Última validación: build, 79 pruebas unitarias, 2 e2e y 468 comprobaciones de integración con Chromium aprobadas. Capturas y reproducción: `docs/REGRESION_CORTESIA_INVALIDA.md`. Sin nuevas migraciones.
