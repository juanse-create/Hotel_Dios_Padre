-- Ejecutar antes de iniciar la nueva versión. Respaldar previamente; admite reejecución.
-- MySQL DDL hace COMMIT implícito: no envolver en una transacción engañosa.
-- No asigna privilegios a ningún usuario existente.
INSERT INTO roles (nombre, descripcion, activo)
SELECT 'Superadministrador', 'Administrador con gestión del límite de cortesías', 1
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE nombre = 'Superadministrador');

CREATE TABLE IF NOT EXISTS configuracion_cortesias (
  id TINYINT NOT NULL PRIMARY KEY,
  maximo_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
  CONSTRAINT chk_cortesia_config CHECK (id = 1 AND maximo_porcentaje BETWEEN 0 AND 100)
) ENGINE=InnoDB;
INSERT INTO configuracion_cortesias (id, maximo_porcentaje)
SELECT 1, 0 WHERE NOT EXISTS (SELECT 1 FROM configuracion_cortesias WHERE id = 1);

-- Reejecutable: conserva tanto los porcentajes existentes como el límite configurado.
SET @cortesia_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'reservaciones'
   AND column_name = 'cortesia_porcentaje') = 0,
  'ALTER TABLE reservaciones ADD COLUMN cortesia_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0, ADD CONSTRAINT chk_reserva_cortesia CHECK (cortesia_porcentaje BETWEEN 0 AND 100)',
  'SELECT 1'
);
PREPARE cortesia_stmt FROM @cortesia_ddl;
EXECUTE cortesia_stmt;
DEALLOCATE PREPARE cortesia_stmt;
