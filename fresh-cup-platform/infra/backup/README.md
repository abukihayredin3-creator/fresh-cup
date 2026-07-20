# Disaster recovery — backups & restore testing

## Targets

- **RPO (Recovery Point Objective): ≤ 24 hours.** Nightly `pg_dump` via
  `fresh-cup-pg-backup` (`backup-cronjob.yaml`). If your managed
  Postgres provider offers continuous WAL archiving / point-in-time
  recovery (RDS, Cloud SQL, etc.), enable it too — that gets RPO down to
  minutes and this nightly dump becomes a second, independent line of
  defense rather than the only one.
- **RTO (Recovery Time Objective): ≤ 1 hour** for a full database
  restore onto a fresh Postgres instance, assuming the archive is
  already downloaded (a `pg_restore --format=custom` of this platform's
  current data volume takes minutes, not hours; most of the RTO budget
  is provisioning a replacement Postgres instance and repointing
  `DATABASE_URL`).

## Backups

`fresh-cup-pg-backup` runs nightly (`infra/backup/backup-cronjob.yaml`,
`infra/backup/scripts/pg-backup.sh`): `pg_dump --format=custom`, upload
to S3-compatible object storage, prune anything older than
`BACKUP_RETENTION_DAYS` (default 30). Store the bucket in a **different
region/provider than the primary database** — a backup that lives next
to the thing it's backing up doesn't survive a regional outage.

## Restore testing

A backup nobody has ever restored is not a verified backup.
`fresh-cup-pg-restore-test` runs weekly
(`infra/backup/restore-test-cronjob.yaml`,
`infra/backup/scripts/pg-restore-test.sh`): downloads the most recent
archive, restores it into a disposable `fresh_cup_restore_test`
database, checks that migrations applied and that core tables have
rows, then drops the scratch database. A non-zero exit fails the
Kubernetes Job, which `kube-state-metrics`' `kube_job_status_failed`
metric (scraped by the same Prometheus as
`infra/observability/prometheus-scrape-config.yaml`) turns into an
alert via `infra/observability/alert-rules.yaml`'s
`FreshCupRestoreTestFailed` rule — no extra code needed, CronJob failure
IS the signal.

## Manual restore procedure (real incident)

1. Provision a fresh Postgres instance (or use the DR region's standby).
2. Download the desired archive:
   `aws --endpoint-url $BACKUP_S3_ENDPOINT s3 cp s3://$BACKUP_S3_BUCKET/postgres/<file>.dump ./restore.dump`
3. `pg_restore --no-owner --no-privileges --dbname="$NEW_DATABASE_URL" restore.dump`
4. Update the `DATABASE_URL` in `fresh-cup-api-secrets`
   (`kubectl -n fresh-cup edit secret fresh-cup-api-secrets`, or your
   secret manager) to point at the restored instance.
5. Roll the API Deployment to pick up the new secret:
   `kubectl -n fresh-cup rollout restart deployment/fresh-cup-api`
6. Verify `/health/ready` reports `database: true` and spot-check recent
   orders against what customers/staff report actually happened —
   `pg_dump` is a point-in-time snapshot, so anything written between
   the last backup and the incident is gone unless WAL/PITR is also in
   place (see RPO note above).

## What this does NOT cover

Redis is treated as ephemeral cache/session state, not a system of
record — no backup job for it. If that assumption changes (e.g. Redis
starts holding data with no Postgres source of truth), it needs its own
backup story before this DR plan is complete.
