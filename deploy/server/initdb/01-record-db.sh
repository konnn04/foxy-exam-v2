#!/bin/sh
# Runs once, on first start of the Postgres volume: a separate database for the recording service,
# so it owns its schema and can be moved to another server later without touching the core.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  SELECT 'CREATE DATABASE foxy_record OWNER ${POSTGRES_USER}'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'foxy_record')\gexec
SQL
