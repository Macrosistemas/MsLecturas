-- MsLecturas — crea la tabla de log de sincronización (dbo.sync_log_app)
-- Ejecutar una sola vez en el servidor SQL. Ver routes/authSync.js (POST /api/sync/log).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'sync_log_app' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.sync_log_app (
        log_id      INT IDENTITY(1,1) PRIMARY KEY,
        usuario     VARCHAR(10)  NOT NULL,
        tipo        VARCHAR(50)  NOT NULL,
        detalle     VARCHAR(500) NULL,
        fecha       DATETIME     NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_sync_log_app_fecha ON dbo.sync_log_app(fecha);
END
