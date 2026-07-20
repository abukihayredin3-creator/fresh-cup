#!/usr/bin/env bash
# Disaster-recovery proof, not just a backup job: downloads the MOST
# RECENT backup archive, restores it into a disposable scratch
# database, runs a real integrity check against the restored data, then
# drops the scratch database. A backup nobody has ever restored is not
# a verified backup — this is what makes the claim "we have backups"
# actually true. Meant to run on a schedule (see restore-test-cronjob.yaml)
# so a silently-corrupt backup is caught within days, not discovered
# during a real incident.
#
# Required env: DATABASE_URL (used only to derive connection
# host/port/user for the scratch DB — never written to), RESTORE_TEST_DB
# (default fresh_cup_restore_test), BACKUP_S3_BUCKET,
# BACKUP_S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
set -euo pipefail

RESTORE_TEST_DB="${RESTORE_TEST_DB:-fresh_cup_restore_test}"
ARCHIVE="/tmp/restore-test.dump"

echo "Finding the most recent backup..."
LATEST_KEY=$(aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3api list-objects-v2 \
  --bucket "${BACKUP_S3_BUCKET}" --prefix "postgres/" \
  --query "sort_by(Contents, &LastModified)[-1].Key" --output text)

if [[ -z "$LATEST_KEY" || "$LATEST_KEY" == "None" ]]; then
  echo "FAIL: no backup archives found in s3://${BACKUP_S3_BUCKET}/postgres/" >&2
  exit 1
fi

echo "Downloading ${LATEST_KEY}..."
aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3 cp "s3://${BACKUP_S3_BUCKET}/${LATEST_KEY}" "${ARCHIVE}"

ADMIN_URL="${DATABASE_URL%/*}/postgres"

echo "Creating disposable database ${RESTORE_TEST_DB}..."
psql "${ADMIN_URL}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${RESTORE_TEST_DB};"
psql "${ADMIN_URL}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${RESTORE_TEST_DB};"

RESTORE_URL="${DATABASE_URL%/*}/${RESTORE_TEST_DB}"

echo "Restoring ${LATEST_KEY} into ${RESTORE_TEST_DB}..."
pg_restore --no-owner --no-privileges --dbname="${RESTORE_URL}" "${ARCHIVE}"

echo "Verifying restored data..."
ORDER_COUNT=$(psql "${RESTORE_URL}" -t -A -c "SELECT count(*) FROM orders;")
MIGRATION_COUNT=$(psql "${RESTORE_URL}" -t -A -c "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;")

STATUS=0
if [[ "${MIGRATION_COUNT}" -lt 1 ]]; then
  echo "FAIL: restored database has no applied migrations" >&2
  STATUS=1
fi
echo "Restored database has ${ORDER_COUNT} order row(s) and ${MIGRATION_COUNT} applied migration(s)."

echo "Cleaning up ${RESTORE_TEST_DB}..."
psql "${ADMIN_URL}" -v ON_ERROR_STOP=1 -c "DROP DATABASE ${RESTORE_TEST_DB};"
rm -f "${ARCHIVE}"

if [[ "$STATUS" -eq 0 ]]; then
  echo "Restore test PASSED for ${LATEST_KEY}."
else
  echo "Restore test FAILED for ${LATEST_KEY}."
fi
exit "$STATUS"
