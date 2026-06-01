#!/bin/sh
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Aguardando DB ficar pronto..."
for i in $(seq 1 30); do
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p 5432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DB pronto."
    break
  fi
  sleep 2
done

while true; do
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  DUMP_FILE="/backups/backup_${TIMESTAMP}.sql"
  PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p 5432 -U "$DB_USER" "$DB_NAME" > "$DUMP_FILE" 2>> /backups/backup.log
  EXIT_CODE=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] backup_${TIMESTAMP}.sql — $EXIT_CODE" >> /backups/backup.log
  if [ $EXIT_CODE -ne 0 ]; then
    rm -f "$DUMP_FILE"
  fi
  find /backups -name "backup_*.sql" -mtime +7 -delete 2>/dev/null
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Proximo backup em 24h" >> /backups/backup.log
  sleep 86400
done