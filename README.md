# Adaptación de módulos

## 1. Base de datos

Ejecuta `2026_07_habitaciones_fotos.sql` una sola vez en phpMyAdmin.

## 2. Carpetas

Asegúrate de que exista:
`public/uploads/habitaciones`

NestJS escribirá ahí las imágenes JPG, PNG o WEBP (máximo 5 MB).

## 3. Tarifas

Se quitó `TarifasModule` de `src/app.module.ts` y se quitó la opción Tarifas del menú de `public/admin.js`.
No se elimina la tabla `tarifas` para no romper datos históricos. Puedes dejarla sin uso.

## 4. Reservaciones

El rol `Administrador` representa también a recepción. El usuario conectado se guarda como `usuario_id`, de modo que cada reservación indica qué recepcionista la registró.

## 5. Habitaciones

El botón Eliminar realiza eliminación lógica (`activa = 0`) para conservar historiales. Las fotos se almacenan físicamente en `public/uploads/habitaciones` y la URL se guarda en `habitaciones.foto_url`.

## 6. Instalación

Copia los archivos sobre las mismas rutas del proyecto, luego ejecuta:

```powershell
npm install
npm run build
npm run start:dev
```

## 6. Prueba del pull requests

Cambio en README
