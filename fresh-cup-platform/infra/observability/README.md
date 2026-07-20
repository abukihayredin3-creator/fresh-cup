# Observability

- **Metrics**: `apps/api`'s `/metrics` endpoint (prom-client, see
  `apps/api/src/common/observability/`) exposes request-duration
  histograms, request counters, and default Node process metrics.
  `prometheus-scrape-config.yaml` is the scrape config for a
  self-managed Prometheus; the `prometheus.io/scrape` pod annotations
  on every `infra/k8s/*/api-deployment*.yaml` Deployment are what let
  it auto-discover pods.
- **Alerting**: `alert-rules.yaml` — error rate, latency, crash-looping,
  degraded health-check dependencies, HPA saturation, and a failed
  weekly backup-restore test (see `infra/backup/README.md`).
- **Distributed tracing**: `otel-collector-config.yaml` — see the
  file's header comment for the honest scope decision (correlation-ID
  tracing via `traceId`, not full OTel span auto-instrumentation yet).
- **Log aggregation**: `fluent-bit-configmap.yaml` — ships every pod's
  JSON stdout into Loki, parsed so `traceId`/`level` are queryable
  fields, not buried in a raw string.

None of this has a live backend to point at in this environment
(no Prometheus, Loki, or Tempo actually running here) — these are
reviewed, valid configs for wiring into a real observability stack, not
something exercised end-to-end in this sandbox.
