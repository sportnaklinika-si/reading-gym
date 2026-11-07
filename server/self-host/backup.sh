#!/bin/sh
# A dump of the friends' database every night (after 3:00 UTC), kept 14 days in ./backups next to compose.yaml.
# Restore: gunzip -c backups/bm-YYYY-MM-DD.sql.gz | docker compose exec -T db psql -U postgres
while true; do
  f="/backups/bm-$(date -u +%F).sql.gz"
  if [ "$(date -u +%H)" -ge 3 ] && [ ! -f "$f" ]; then
    if pg_dump -h db -U postgres -d postgres --no-owner --clean --if-exists | gzip > /backups/.part.gz; then
      mv /backups/.part.gz "$f"
      find /backups -name 'bm-*.sql.gz' -mtime +14 -delete
    fi
  fi
  sleep 600
done
