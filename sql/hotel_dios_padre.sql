-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 13-08-2026 a las 11:59:50
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `hotel_dios_padre`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `asignaciones_limpieza`
--

CREATE TABLE `asignaciones_limpieza` (
  `id` int(11) NOT NULL,
  `habitacion_id` int(11) DEFAULT NULL,
  `camarista_id` int(11) DEFAULT NULL,
  `fecha` date DEFAULT NULL,
  `estado` enum('Pendiente','En proceso','Finalizada') DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `asignaciones_limpieza`
--

INSERT INTO `asignaciones_limpieza` (`id`, `habitacion_id`, `camarista_id`, `fecha`, `estado`) VALUES
(1, 1, 2, '2026-07-12', 'Finalizada'),
(2, 1, 2, '2026-07-14', 'Finalizada'),
(3, 4, 2, '2026-07-14', 'Finalizada'),
(4, 3, 2, '2026-07-15', 'Finalizada'),
(5, 1, 2, '2026-07-15', 'Finalizada'),
(6, 1, 2, '2026-07-19', 'Finalizada'),
(7, 1, 2, '2026-07-21', 'Finalizada'),
(8, 1, 2, '2026-08-04', 'Pendiente'),
(9, 1, 2, '2026-08-03', 'Pendiente');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `bitacora`
--

CREATE TABLE `bitacora` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `modulo` varchar(100) DEFAULT NULL,
  `accion` varchar(200) DEFAULT NULL,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `checkin`
--

CREATE TABLE `checkin` (
  `id` int(11) NOT NULL,
  `reservacion_id` int(11) DEFAULT NULL,
  `fecha` datetime DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `observaciones` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `checkin`
--

INSERT INTO `checkin` (`id`, `reservacion_id`, `fecha`, `usuario_id`, `observaciones`) VALUES
(1, 2, '2026-07-15 16:24:13', 1, ''),
(2, 3, '2026-07-19 14:23:38', 1, '');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `checkout`
--

CREATE TABLE `checkout` (
  `id` int(11) NOT NULL,
  `reservacion_id` int(11) DEFAULT NULL,
  `fecha` datetime DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `observaciones` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `checkout`
--

INSERT INTO `checkout` (`id`, `reservacion_id`, `fecha`, `usuario_id`, `observaciones`) VALUES
(1, 2, '2026-07-15 16:24:21', 1, '');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `estados_habitacion`
--

CREATE TABLE `estados_habitacion` (
  `id` int(11) NOT NULL,
  `nombre` varchar(50) DEFAULT NULL,
  `descripcion` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `estados_habitacion`
--

INSERT INTO `estados_habitacion` (`id`, `nombre`, `descripcion`) VALUES
(1, 'Disponible', 'La habitación está libre y puede reservarse o asignarse.'),
(2, 'En proceso de reservación', 'Bloqueo temporal durante el proceso de reservación.'),
(3, 'Reservada', 'Reservación confirmada pendiente de check-in.'),
(4, 'Ocupada', 'Huésped hospedado actualmente.'),
(5, 'Pendiente de limpieza', 'Requiere limpieza después del check-out.'),
(6, 'Sucia', 'Asignada a limpieza y aún no atendida.'),
(7, 'En proceso', 'La camarista está realizando la limpieza.'),
(8, 'Limpia', 'Limpieza finalizada y lista para habilitarse.'),
(9, 'Fuera de servicio', 'No disponible por mantenimiento o incidencia.');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `habitaciones`
--

CREATE TABLE `habitaciones` (
  `id` int(11) NOT NULL,
  `numero` varchar(20) DEFAULT NULL,
  `piso` int(11) DEFAULT NULL,
  `tipo_id` int(11) DEFAULT NULL,
  `estado_id` int(11) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `foto_url` varchar(255) DEFAULT NULL,
  `activa` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `habitaciones`
--

INSERT INTO `habitaciones` (`id`, `numero`, `piso`, `tipo_id`, `estado_id`, `observaciones`, `foto_url`, `activa`) VALUES
(1, '101', 1, 1, 6, NULL, NULL, 1),
(2, '102', 1, 1, 4, NULL, NULL, 1),
(3, '201', 2, 2, 1, '', NULL, 1),
(4, '103', 2, 2, 4, '', NULL, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `huespedes`
--

CREATE TABLE `huespedes` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) DEFAULT NULL,
  `apellido_paterno` varchar(80) DEFAULT NULL,
  `apellido_materno` varchar(80) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `correo` varchar(120) DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `identificacion` varchar(80) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `huespedes`
--

INSERT INTO `huespedes` (`id`, `nombre`, `apellido_paterno`, `apellido_materno`, `telefono`, `correo`, `direccion`, `identificacion`, `created_at`) VALUES
(1, 'Elian', 'hola', 'Andrade', '5555555412', 'Licona2103@outlook.com', 'bugambilias', 'curp', '2026-07-14 19:17:46'),
(2, 'Elian', 'Licona', 'Andrade', '7721388936', 'licona2103@outlook.com', 'bugambilias', 'LIAE030121HHGCNA1', '2026-07-14 22:04:28'),
(4, 'Elian', 'hola', 'Andrade', '7721388936', 'Licona2103@outlook.com', 'bugambilias', 'LIAE030121HHGCNA1', '2026-07-15 22:23:59'),
(5, 'BRANDON YAHIR', 'MARTINEZ', 'OLGUIN', '7721424512', 'yahirm049@gmail.com', 'Calle Emiliano Zapata S/N', 'INE', '2026-07-19 19:38:23');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `observaciones`
--

CREATE TABLE `observaciones` (
  `id` int(11) NOT NULL,
  `habitacion_id` int(11) DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `tipo` enum('Recepción','Camarista','Administrador') DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `observaciones`
--

INSERT INTO `observaciones` (`id`, `habitacion_id`, `usuario_id`, `tipo`, `descripcion`, `created_at`) VALUES
(1, 1, 2, 'Camarista', 'control no encontrado ', '2026-07-14 18:08:22'),
(2, 1, 2, 'Camarista', 'hhh', '2026-07-14 18:12:25');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `reservaciones`
--

CREATE TABLE `reservaciones` (
  `id` int(11) NOT NULL,
  `folio` varchar(30) DEFAULT NULL,
  `huesped_id` int(11) DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `fecha_inicio` date DEFAULT NULL,
  `fecha_fin` date DEFAULT NULL,
  `adultos` int(11) DEFAULT NULL,
  `menores` int(11) DEFAULT NULL,
  `estado` enum('En proceso','Confirmada','Cancelada','Finalizada') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `reservaciones`
--

INSERT INTO `reservaciones` (`id`, `folio`, `huesped_id`, `usuario_id`, `fecha_inicio`, `fecha_fin`, `adultos`, `menores`, `estado`, `created_at`) VALUES
(2, 'RES-1784154239261', 4, 1, '2026-07-14', '2026-07-15', 1, 0, 'Finalizada', '2026-07-15 22:23:59'),
(3, 'RES-1784489903948', 5, 1, '2026-07-19', '2026-07-20', 2, 0, 'Confirmada', '2026-07-19 19:38:23');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `reservacion_habitaciones`
--

CREATE TABLE `reservacion_habitaciones` (
  `id` int(11) NOT NULL,
  `reservacion_id` int(11) DEFAULT NULL,
  `habitacion_id` int(11) DEFAULT NULL,
  `precio` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `reservacion_habitaciones`
--

INSERT INTO `reservacion_habitaciones` (`id`, `reservacion_id`, `habitacion_id`, `precio`) VALUES
(3, 2, 1, 0.00),
(5, 3, 2, 850.00);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `descripcion` varchar(200) DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `roles`
--

INSERT INTO `roles` (`id`, `nombre`, `descripcion`, `activo`) VALUES
(5, 'Administrador', 'Acceso total al sistema y funciones de recepción', 1),
(6, 'Camarista', 'Gestiona la limpieza y mantenimiento de las habitaciones', 1),
(7, 'Taquilla', 'Consulta de habitaciones para personal de taquilla', 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tarifas`
--

CREATE TABLE `tarifas` (
  `id` int(11) NOT NULL,
  `tipo_habitacion_id` int(11) DEFAULT NULL,
  `temporada` varchar(80) DEFAULT NULL,
  `precio` decimal(10,2) DEFAULT NULL,
  `fecha_inicio` date DEFAULT NULL,
  `fecha_fin` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tipos_habitacion`
--

CREATE TABLE `tipos_habitacion` (
  `id` int(11) NOT NULL,
  `nombre` varchar(60) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `capacidad` int(11) DEFAULT NULL,
  `camas` int(11) DEFAULT NULL,
  `precio` decimal(10,2) DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `tipos_habitacion`
--

INSERT INTO `tipos_habitacion` (`id`, `nombre`, `descripcion`, `capacidad`, `camas`, `precio`, `activo`) VALUES
(1, 'Estándar', 'Habitación estándar', 2, 1, 850.00, 1),
(2, 'Doble', 'Habitación con dos camas', 4, 2, 1250.00, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) DEFAULT NULL,
  `apellido_paterno` varchar(80) DEFAULT NULL,
  `apellido_materno` varchar(80) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `correo` varchar(120) DEFAULT NULL,
  `usuario` varchar(50) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `rol_id` int(11) DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `nombre`, `apellido_paterno`, `apellido_materno`, `telefono`, `correo`, `usuario`, `password`, `rol_id`, `activo`, `created_at`) VALUES
(1, 'Administrador', NULL, NULL, NULL, 'admin@diospadre.local', 'admin', '$2b$10$xuzoDk4S0Ue0hxpWCacTiedruY5/hfN9krLlfOjReU9vVFIz.N2va', 5, 1, '2026-07-12 19:51:00'),
(2, 'Camarista Martita', NULL, NULL, NULL, 'camarista@diospadre.local', 'camarista', '$2b$10$dtUfxHu1O2U8Xsl3HSNm0.epIYS84KA554PxdbsS0rQsSZ4zT68ui', 6, 1, '2026-07-12 19:51:00'),
(4, 'Elian', 'Licona', 'Andrade', '7721388936', 'Licona2103@outlook.com', 'admin1', '$2b$10$/0AaZ2LfUDMZognzzhP6qO9f2R4qnOJvEnS9jrkN36YE8sdfwb24S', 6, 1, '2026-07-14 19:03:10'),
(5, 'Taquilla', NULL, NULL, NULL, 'taquilla@diospadre.local', 'taquilla', '$2b$10$HgYiHq81ur/Q5TuwiVtsHekxS3cpUBQGkm3OThQTm1EKkyB6YhqXy', 7, 1, '2026-07-15 03:17:29');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `asignaciones_limpieza`
--
ALTER TABLE `asignaciones_limpieza`
  ADD PRIMARY KEY (`id`),
  ADD KEY `habitacion_id` (`habitacion_id`),
  ADD KEY `camarista_id` (`camarista_id`);

--
-- Indices de la tabla `bitacora`
--
ALTER TABLE `bitacora`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `checkin`
--
ALTER TABLE `checkin`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reservacion_id` (`reservacion_id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `checkout`
--
ALTER TABLE `checkout`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reservacion_id` (`reservacion_id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `estados_habitacion`
--
ALTER TABLE `estados_habitacion`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `habitaciones`
--
ALTER TABLE `habitaciones`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero` (`numero`),
  ADD KEY `tipo_id` (`tipo_id`),
  ADD KEY `estado_id` (`estado_id`);

--
-- Indices de la tabla `huespedes`
--
ALTER TABLE `huespedes`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `observaciones`
--
ALTER TABLE `observaciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `habitacion_id` (`habitacion_id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `reservaciones`
--
ALTER TABLE `reservaciones`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `folio` (`folio`),
  ADD KEY `huesped_id` (`huesped_id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `reservacion_habitaciones`
--
ALTER TABLE `reservacion_habitaciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reservacion_id` (`reservacion_id`),
  ADD KEY `habitacion_id` (`habitacion_id`);

--
-- Indices de la tabla `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `tarifas`
--
ALTER TABLE `tarifas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tipo_habitacion_id` (`tipo_habitacion_id`);

--
-- Indices de la tabla `tipos_habitacion`
--
ALTER TABLE `tipos_habitacion`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `correo` (`correo`),
  ADD UNIQUE KEY `usuario` (`usuario`),
  ADD KEY `rol_id` (`rol_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `asignaciones_limpieza`
--
ALTER TABLE `asignaciones_limpieza`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de la tabla `bitacora`
--
ALTER TABLE `bitacora`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `checkin`
--
ALTER TABLE `checkin`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `checkout`
--
ALTER TABLE `checkout`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `estados_habitacion`
--
ALTER TABLE `estados_habitacion`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de la tabla `habitaciones`
--
ALTER TABLE `habitaciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `huespedes`
--
ALTER TABLE `huespedes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `observaciones`
--
ALTER TABLE `observaciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `reservaciones`
--
ALTER TABLE `reservaciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `reservacion_habitaciones`
--
ALTER TABLE `reservacion_habitaciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `tarifas`
--
ALTER TABLE `tarifas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `tipos_habitacion`
--
ALTER TABLE `tipos_habitacion`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `asignaciones_limpieza`
--
ALTER TABLE `asignaciones_limpieza`
  ADD CONSTRAINT `asignaciones_limpieza_ibfk_1` FOREIGN KEY (`habitacion_id`) REFERENCES `habitaciones` (`id`),
  ADD CONSTRAINT `asignaciones_limpieza_ibfk_2` FOREIGN KEY (`camarista_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `bitacora`
--
ALTER TABLE `bitacora`
  ADD CONSTRAINT `bitacora_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `checkin`
--
ALTER TABLE `checkin`
  ADD CONSTRAINT `checkin_ibfk_1` FOREIGN KEY (`reservacion_id`) REFERENCES `reservaciones` (`id`),
  ADD CONSTRAINT `checkin_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `checkout`
--
ALTER TABLE `checkout`
  ADD CONSTRAINT `checkout_ibfk_1` FOREIGN KEY (`reservacion_id`) REFERENCES `reservaciones` (`id`),
  ADD CONSTRAINT `checkout_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `habitaciones`
--
ALTER TABLE `habitaciones`
  ADD CONSTRAINT `habitaciones_ibfk_1` FOREIGN KEY (`tipo_id`) REFERENCES `tipos_habitacion` (`id`),
  ADD CONSTRAINT `habitaciones_ibfk_2` FOREIGN KEY (`estado_id`) REFERENCES `estados_habitacion` (`id`);

--
-- Filtros para la tabla `observaciones`
--
ALTER TABLE `observaciones`
  ADD CONSTRAINT `observaciones_ibfk_1` FOREIGN KEY (`habitacion_id`) REFERENCES `habitaciones` (`id`),
  ADD CONSTRAINT `observaciones_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `reservaciones`
--
ALTER TABLE `reservaciones`
  ADD CONSTRAINT `reservaciones_ibfk_1` FOREIGN KEY (`huesped_id`) REFERENCES `huespedes` (`id`),
  ADD CONSTRAINT `reservaciones_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `reservacion_habitaciones`
--
ALTER TABLE `reservacion_habitaciones`
  ADD CONSTRAINT `reservacion_habitaciones_ibfk_1` FOREIGN KEY (`reservacion_id`) REFERENCES `reservaciones` (`id`),
  ADD CONSTRAINT `reservacion_habitaciones_ibfk_2` FOREIGN KEY (`habitacion_id`) REFERENCES `habitaciones` (`id`);

--
-- Filtros para la tabla `tarifas`
--
ALTER TABLE `tarifas`
  ADD CONSTRAINT `tarifas_ibfk_1` FOREIGN KEY (`tipo_habitacion_id`) REFERENCES `tipos_habitacion` (`id`);

--
-- Filtros para la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
