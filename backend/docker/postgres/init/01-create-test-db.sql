-- Runs once, on first initialisation of the postgres data volume.
SELECT 'CREATE DATABASE sukamenak_test OWNER sukamenak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sukamenak_test')\gexec
