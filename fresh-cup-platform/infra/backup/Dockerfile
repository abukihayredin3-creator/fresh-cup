# Minimal image for the backup/restore-test CronJobs: neither
# postgres:16-alpine (has pg_dump/psql, no aws-cli) nor amazon/aws-cli
# (has aws-cli, no pg_dump/psql) has both tools these scripts need.
#
# Build from the monorepo root:
#   docker build -f infra/backup/Dockerfile -t fresh-cup-backup-tools infra/backup
FROM postgres:16-alpine
RUN apk add --no-cache aws-cli bash
COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh
