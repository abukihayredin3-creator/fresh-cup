# Fresh Cup — Kubernetes deployment

Phase 8 Part 5 infrastructure-as-code for `apps/api`. This is real,
`kubectl apply`-able YAML — but there is no live cluster in this
environment to apply it to, so nothing here has actually been deployed
or tested against a running cluster. Treat it as a reviewed starting
point, not a battle-tested one.

## Layout

- `base/` — the steady-state deployment: `Namespace`, `ConfigMap`
  (non-secret config), `Secret` template (values are placeholders —
  populate via your cluster's secret manager, never commit real
  values), `Deployment`, `Service`, `HorizontalPodAutoscaler`,
  `PodDisruptionBudget`, `Ingress`. Apply with:
  `kubectl apply -k infra/k8s/base`
- `blue-green/` — an alternate `Deployment` pair (`api-blue`/
  `api-green`) plus `scripts/switch.sh`, which flips the `Service`
  selector between them. Vanilla Kubernetes has no built-in blue/green
  primitive, so this is the standard "two Deployments, one Service,
  flip the selector" approach — not Argo Rollouts or Flagger, which
  would be a new, fairly heavy dependency for a single-service
  platform this size.
- `canary/` — a canary `Deployment` plus an `Ingress` using
  ingress-nginx's `nginx.ingress.kubernetes.io/canary` annotations for
  weighted traffic splitting. ingress-nginx is a common baseline
  ingress controller (not a new dependency beyond assuming _an_
  ingress controller exists), and its canary annotations are a real,
  documented feature — this is genuine weighted routing, not a
  replica-count approximation.

## Assumptions

- Postgres and Redis are managed services (RDS/Cloud SQL/ElastiCache/
  Azure equivalents, or a StatefulSet you operate separately) reachable
  via `DATABASE_URL`/`REDIS_URL` in the Secret — this repo does not
  ship a production Postgres/Redis StatefulSet, only the local dev
  `infra/docker/docker-compose.yml`.
- An image registry and a CI/CD pipeline populate
  `ghcr.io/<org>/fresh-cup-api:<tag>` — see
  `.github/workflows/fresh-cup-deploy.yml`.
- Probes point at the existing `/health` (liveness) and `/health/ready`
  (readiness, checks Postgres + Redis) endpoints from
  `src/modules/health/`.
