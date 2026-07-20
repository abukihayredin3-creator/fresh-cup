#!/usr/bin/env bash
# Dumps the Fresh Cup Postgres database to a timestamped, compressed
# custom-format archive and uploads it to S3-compatible object storage
# (the same MinIO used locally in infra/docker/docker-compose.yml — a
# production deployment points BACKUP_S3_ENDPOINT at a real bucket
# instead). Prunes archives older than BACKUP_RETENTION_DAYS.
#
# Required env: DATABASE_URL, BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT,
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
# Optional env: BACKUP_RETENTION_DAYS (default 30).
set -euo pipefail

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="/tmp/fresh-cup-${TIMESTAMP}.dump"

echo "Dumping database to ${ARCHIVE}..."
pg_dump --format=custom --file="${ARCHIVE}" "${DATABASE_URL}"

echo "Uploading to s3://${BACKUP_S3_BUCKET}/postgres/fresh-cup-${TIMESTAMP}.dump..."
aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3 cp \
  "${ARCHIVE}" "s3://${BACKUP_S3_BUCKET}/postgres/fresh-cup-${TIMESTAMP}.dump"

rm -f "${ARCHIVE}"

echo "Pruning backups older than ${RETENTION_DAYS} days..."
CUTOFF_EPOCH=$(($(date -u +%s) - RETENTION_DAYS * 86400))
aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3api list-objects-v2 \
  --bucket "${BACKUP_S3_BUCKET}" --prefix "postgres/" \
  --query "Contents[?LastModified<='$(date -u -d "@${CUTOFF_EPOCH}" +%Y-%m-%dT%H:%M:%S)'].Key" \
  --output text |
  tr '\t' '\n' |
  while read -r key; do
    [[ -z "$key" ]] && continue
    echo "Deleting expired backup: ${key}"
    aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3 rm "s3://${BACKUP_S3_BUCKET}/${key}"
  done

echo "Backup complete."
