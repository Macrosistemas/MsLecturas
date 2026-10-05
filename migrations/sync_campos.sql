-- ============================================================
-- MsLecturas — Campos de sincronización para se_lecturas
-- Ejecutar UNA sola vez en el servidor SQL
-- ============================================================

-- Verificar si ya existen antes de agregar (SQL Server)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.se_lecturas') AND name = 'sync_estado')
    ALTER TABLE dbo.se_lecturas ADD sync_estado CHAR(1) NOT NULL DEFAULT 'S';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.se_lecturas') AND name = 'sync_origen')
    ALTER TABLE dbo.se_lecturas ADD sync_origen VARCHAR(50) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.se_lecturas') AND name = 'sync_fecha')
    ALTER TABLE dbo.se_lecturas ADD sync_fecha DATETIME NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.se_lecturas') AND name = 'sync_version')
    ALTER TABLE dbo.se_lecturas ADD sync_version INT NOT NULL DEFAULT 1;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.se_lecturas') AND name = 'local_id')
    ALTER TABLE dbo.se_lecturas ADD local_id VARCHAR(50) NULL;

-- Índice para acelerar consultas de sync
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.se_lecturas') AND name = 'IX_se_lecturas_sync')
    CREATE INDEX IX_se_lecturas_sync ON dbo.se_lecturas (sync_estado, sync_fecha);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.se_lecturas') AND name = 'IX_se_lecturas_local_id')
    CREATE INDEX IX_se_lecturas_local_id ON dbo.se_lecturas (local_id);

-- ============================================================
-- Valores posibles de sync_estado:
--   S = Sincronizado
--   P = Pendiente de subir al servidor
--   C = Conflicto detectado
--   B = Marcar para borrar en servidor
-- ============================================================
PRINT 'Campos de sync agregados correctamente a se_lecturas';
