#!/usr/bin/env bash
# Daily backup of one environment: PostgreSQL (pg_dump custom format) and the file storage volume.
# Run on the server from this folder, e.g. by cron:  15 2 * * *  /srv/sukamenak/staging/backup.sh
# CORE_PROMPT_KEY is NOT in these files: keep it separately, or the core prompts cannot be decrypted.
# The dumps hold user accounts (password hashes, e-mail) and encrypted core prompts: owner-only permissions.
# Encrypt them before copying them off the server (see deploy/README.md).
set -euo pipefail
umask 077
cd "$(dirname "$0")"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
compose() { docker compose -f docker-compose.prod.yml --env-file .env "$@"; }

ts="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

compose exec -T postgres pg_dump -U sukamenak -d sukamenak -Fc > "$BACKUP_DIR/db-$ts.dump.part"
mv "$BACKUP_DIR/db-$ts.dump.part" "$BACKUP_DIR/db-$ts.dump"

compose exec -T api tar czf - -C /app/backend storage > "$BACKUP_DIR/storage-$ts.tar.gz.part"
mv "$BACKUP_DIR/storage-$ts.tar.gz.part" "$BACKUP_DIR/storage-$ts.tar.gz"

find "$BACKUP_DIR" -maxdepth 1 \( -name 'db-*.dump' -o -name 'storage-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "backup ok: $BACKUP_DIR/db-$ts.dump, $BACKUP_DIR/storage-$ts.tar.gz"
