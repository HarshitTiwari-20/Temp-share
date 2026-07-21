-- Production-oriented PostgreSQL init for TempShare
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Optional: connection/session defaults
ALTER SYSTEM SET log_min_duration_statement = 500;
SELECT pg_reload_conf();
