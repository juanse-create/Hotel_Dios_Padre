# Validación funcional — PR #4 (Draft)

Actualización posterior: ver [regresión de cortesía inválida](REGRESION_CORTESIA_INVALIDA.md)
para la corrección del total negativo y la última ejecución de 468 comprobaciones.

**Resultado:** listo para revisión técnica con las correcciones de este informe.
No se autoriza ni se realiza merge. Se confirmó con el usuario que el pago sigue siendo obligatorio incluso con
cortesía de 100%. Antes del merge se recomienda ensayar en MySQL con un esquema
equivalente al real.

## Entorno y aislamiento

- Rama exclusiva: `feature/superadmin-cortesias`.
- Node.js 24.22.1, NestJS 11, MariaDB 11.8.6, Chromium 155, Playwright.
- MariaDB solo en `127.0.0.1:3307`; Nest de pruebas en el puerto 3099.
- Cada ejecución crea `hotel_cortesias_test_<sufijo aleatorio>`.
- Se extrae **solo DDL** del archivo SQL versionado y se insertan huéspedes,
  habitaciones, roles y usuarios sintéticos. No se importan sus filas existentes.
- Contraseñas y JWT aleatorios; sin credenciales reales, conexiones de producción,
  modificación de datos reales ni operaciones sobre Railway.
- Las pruebas rechazan hosts de BD que no sean locales. La suite e2e exige además
  el nombre de un fixture sintético. Las bases se eliminan al finalizar salvo
  conservación explícita para pruebas manuales.

## Resultados finales

| Prueba | Resultado |
| --- | --- |
| Compilación `npm run build` | Aprobada |
| Unitarias, 7 suites | 56 aprobadas, 0 fallidas |
| E2E, arranque real del hotel | 2 aprobadas, 0 fallidas |
| Integración HTTP/JWT + Chromium | 159 comprobaciones aprobadas, 0 fallidas |
| Login web Administrador y Superadministrador | Ambos acceden al mismo panel |
| Menú/guardado de configuración | Solo Superadministrador; Administrador recibe 403 incluso con petición directa desde navegador |
| Creación de una reserva desde Recepción | Administrador, 30% de cortesía, pago 100, saldo 1300 |
| Selector de roles en Usuarios | Superadministrador disponible solo al usuario privilegiado |
| Autoascenso/asignación mediante `rolId` manipulado | Rechazados con 403 |
| Cambiar contraseña, estado o desactivar una cuenta privilegiada como Administrador | Rechazado con 403 |
| Revocación del rol con JWT aún vigente | Nuevo intento de configurar recibe 403 |
| Desactivación del usuario con JWT vigente | Recibe 401 |
| Valores negativos, >100, null, cadena vacía/numérica, booleano, objeto, arreglo, exceso de decimales | Rechazados con 400 |
| Exceso del máximo vigente al crear y editar | Rechazado con 400 |
| Peticiones anteriores sin `cortesiaPorcentaje` | Crear usa 0%; editar conserva porcentaje sujeto al límite vigente |
| Disminuir el límite | No recalcula reservas guardadas; se exige al volver a editarlas |
| Errores JavaScript en las rutas visuales ejercitadas | Ninguno |

El registro estructurado sin secretos está en
[evidence/functional-results.json](evidence/functional-results.json).
La contabilización de 159 comprobaciones incluye los escenarios de navegador;
no equivale a 159 casos Jest independientes.

### Matriz de importes

Una habitación de prueba de 1000 por noche, dos noches, anticipo sintético de 100.
Los reportes por tipo y por día se comprueban numéricamente, no solo por HTTP 200.

| Cortesía y máximo autorizado | Bruto | Total neto | Pagado | Saldo | Ganancias en reportes | Resultado |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 2000 | 2000 | 100 | 1900 | 2000 | Aprobado |
| 10% | 2000 | 1800 | 100 | 1700 | 1800 | Aprobado |
| 30% | 2000 | 1400 | 100 | 1300 | 1400 | Aprobado |
| 50% | 2000 | 1000 | 100 | 900 | 1000 | Aprobado |
| 100% | 2000 | 0 | 100 | 0 | 0 | Aprobado con pago conservado |

**Política confirmada por el usuario:** conservar el pago obligatorio incluso con
cortesía de 100%. Se comprobaron los rechazos con 400 para ausencia de pagos,
lista vacía e importes cero o negativos en ese caso. La prueba de 100% conserva
un anticipo y demuestra que el total, saldo y reportes son cero. El saldo cero no
implica devolución del anticipo: no se implementan reembolsos en este cambio.

## Migración confirmada

Se ejecutó `sql/2026_11_superadmin_cortesias.sql` en bases sintéticas nuevas.
Se compararon IDs y folios antes/después; no se perdieron reservas. Las reservas
anteriores recibieron 0% y el límite inicial fue 0%. Reejecutarla después de
configurar 20% conserva ese valor y permite continuar con las mismas reservas.
No asigna Superadministrador a ninguna cuenta existente.

Esta confirmación corresponde a MariaDB local. No se ha probado la migración en
producción ni se dispone de su esquema, tamaño, permisos, SQL modes o MySQL real.
La validación de bloqueos por volumen y una copia MySQL equivalente sigue pendiente.

## Fallos encontrados y corregidos

1. **Login Superadministrador bloqueado en interfaz.** El backend autenticaba,
   pero `public/app.js` exige que el rol corresponda al selector y
   `public/index.html` no ofrecía Superadministrador. Chromium reprodujo el mensaje
   «El usuario no corresponde al tipo de acceso seleccionado». Se agregó la
   opción al selector existente. La regresión ahora prueba login real, sin insertar
   tokens en localStorage ni eludir el formulario.
2. **Suite e2e de plantilla desactualizada.** Esperaba `Hello World!` en una app que
   sirve el acceso del hotel, y recibía 404. El proveedor ServeStatic resolvía un
   loader vacío al compilar `TestingModule` antes de instalar el adaptador HTTP.
   La suite ahora arranca con `NestFactory`, comprueba HTML del login con ambos
   roles y verifica que la configuración sin autenticación devuelve 401. No se
   alteró el servidor para satisfacer la prueba.
3. **Subtotal confundido con total neto.** El campo que conserva el importe bruto
   mostraba «Total de reservación», aunque el resumen descontaba la cortesía. Se
   renombró «Subtotal antes de cortesía» y quedó de solo lectura; las pruebas
   confirman subtotal 2000 y neto 1400 con 30%. Se actualizó la versión del script
   en el HTML para evitar reutilizar la copia anterior en caché.
4. **Cobertura insuficiente.** La prueba anterior no hacía login web ni comprobaba
   numéricamente toda la matriz de porcentajes y reportes. Se añadieron esos
   escenarios, fixtures sin filas reales y captura de evidencia. No se modificaron
   permisos o validaciones para obtener resultados aprobados.

Los fallos reproducidos anteriormente no siguen abiertos después de la corrección.
El pago al 100% es la política expresamente confirmada por el usuario y tiene pruebas de rechazo sin pago.

## Evidencia visual

Se capturó Chromium de escritorio a 1440 × 1000; algunas imágenes incluyen la
página completa. Se inspeccionaron las capturas. El navegador bloqueó recursos
externos durante la prueba: los iconos del CDN pueden no verse; esto no afecta al
flujo local comprobado. No se grabaron trazas con contraseñas o tokens.

- [Administrador: panel](evidence/admin-panel.png)
- [Superadministrador: panel](evidence/super-panel.png)
- [Superadministrador: límite 30%](evidence/super-limite.png)
- [Administrador: reservaciones](evidence/admin-reservaciones.png)
- [Superadministrador: reservaciones](evidence/super-reservaciones.png)
- [Administrador: creación con 30%, total 1400 y saldo 1300](evidence/admin-cortesia-30.png)
- [Fallo de login antes de corregir](evidence/error-login-superadministrador.png)

## Repetir las pruebas

Desde `/workspace/Hotel_Dios_Padre`, en la rama indicada y con MariaDB local activo:

```sh
npm run build
npm test -- --runInBand
BROWSER_TEST=1 DB_HOST=127.0.0.1 DB_PORT=3307 node test/cortesias.integration.cjs
```

El modo visual automatizado requiere `playwright` resoluble desde Node y Chromium
instalado. En este entorno ya están disponibles; no se cambió el lockfile ni las
dependencias del proyecto. `CHROMIUM_PATH` permite indicar otro ejecutable.
Sin navegador, omitir `BROWSER_TEST=1` ejecuta las comprobaciones de API/BD.
`EVIDENCE_DIR` cambia el destino de capturas. `RESULTS_FILE` guarda el registro JSON
sin secretos. El script devuelve código distinto de cero si falla una comprobación.

## Prueba manual

El fixture conservado en esta sesión es totalmente sintético. Su configuración
privada está en `/workspace/.hotel-dev/functional-test.json`, fuera de Git, con
permisos 600. Nest quedó iniciado en el puerto local **3099** usando esa base.
Para volver a iniciarlo si se detiene:

```sh
node test/start-cortesias-local.cjs /workspace/.hotel-dev/functional-test.json
```

Para ejecutar la suite e2e con ese mismo fixture (puede coexistir con el servidor):

```sh
node test/start-cortesias-local.cjs /workspace/.hotel-dev/functional-test.json --e2e
```

Para crear otro fixture desde cero y conservarlo, usar un puerto libre; al terminar
se imprime únicamente la ruta del archivo privado, nunca su contraseña:

```sh
KEEP_TEST_DB=1 TEST_APP_PORT=3100 DB_HOST=127.0.0.1 DB_PORT=3307 node test/cortesias.integration.cjs
```

1. Abrir el acceso del servidor local. Usar `test_super` y elegir Superadministrador.
   La contraseña aleatoria está en `testPassword` del archivo privado; consultarla
   solo localmente en un editor de confianza, sin copiarla en chat, capturas o Git.
2. En **Cortesías**, guardar máximo 30%. Recargar para comprobar persistencia.
3. Cerrar sesión. Entrar como `test_admin`, eligiendo Administrador, con la misma
   contraseña de prueba. Confirmar que no aparece el menú Cortesías ni el rol
   Superadministrador en el formulario de creación de usuarios.
4. En Recepción, introducir un cliente sintético, seleccionar dos noches futuras y
   una habitación disponible. El fixture conserva reservas de prueba en 2099 y 2100;
   usar otras fechas o crear una habitación de prueba si no hay una disponible.
5. Aplicar 10% o 30% y registrar un pago sintético. Comparar resumen, tarjeta y
   reportes filtrados por la estancia. Intentar 30.01%: el formulario lo impide;
   las pruebas de API confirman también el rechazo al eludir esa restricción.
6. Como Superadministrador, repetir con límites 0%, 10%, 30%, 50% y 100%.
   Probar negativos, 101, campo vacío y más de dos decimales. No registrar pagos
   reales ni números de tarjeta reales. El caso 100% exige pago por la política confirmada.
7. Intentar asignar Superadministrador a `test_admin` mediante una petición PATCH
   autenticada a su usuario: debe devolver 403. No ejecutar SQL manual que lo ascienda.

Los procesos no sobreviven necesariamente a una nueva tarea. Si MariaDB se detuvo,
iniciar `/workspace/.hotel-dev/start-db.sh`; no borrar su directorio de datos ni
apuntar a producción para resolver un fallo de conexión.
