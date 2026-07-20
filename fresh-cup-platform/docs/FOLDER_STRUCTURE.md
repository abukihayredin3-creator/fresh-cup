# Monorepo Folder Structure

Turborepo + pnpm workspaces. Rationale: five apps share types, an API
client, a design system, and lint/config — a monorepo keeps those in sync
by construction instead of via published-package version drift.

```
fresh-cup-platform/
├── apps/
│   ├── api/                        # NestJS backend — the only app with DB access
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── identity/       # users, staff, auth, OTP
│   │   │   │   ├── catalog/        # categories, items, variants, modifiers
│   │   │   │   ├── ordering/       # cart, orders, tables/QR
│   │   │   │   ├── payments/       # Chapa integration, webhooks
│   │   │   │   ├── delivery/       # zones, riders, assignment, tracking
│   │   │   │   ├── loyalty/        # points ledger, rewards
│   │   │   │   ├── promotions/     # coupons, campaigns
│   │   │   │   ├── inventory/      # ingredients, recipes, purchase orders
│   │   │   │   ├── notifications/  # SMS/push/email dispatch (queue consumers)
│   │   │   │   ├── analytics/      # reporting endpoints, aggregation jobs
│   │   │   │   ├── intelligence/   # Phase 6 — recommendations, customer/inventory/
│   │   │   │   │                   #   marketing intelligence, forecasting, executive BI, AI assistant
│   │   │   │   └── branches/       # branch/location management
│   │   │   ├── intelligence/       # Phase 11 — Restaurant Intelligence Platform (sibling
│   │   │   │   │                   #   tree to modules/intelligence above, wraps it rather
│   │   │   │   │                   #   than replacing it)
│   │   │   │   ├── controllers/    # one per AI domain + memory + assistant + Part 2 surfaces
│   │   │   │   │                   #   (predictions, forecast, models, retrain, drift, segmentation)
│   │   │   │   ├── services/       # executive/sales/customer/inventory/marketing/kitchen/
│   │   │   │   │                   #   delivery/workforce AI, agent-runner, explanation, security
│   │   │   │   ├── llm/            # LlmProvider interface + factory + providers/ (Part 1)
│   │   │   │   ├── embeddings/     # EmbeddingProvider interface + factory + providers/ (Part 1)
│   │   │   │   ├── vector/         # VectorProvider interface + factory + providers/ (Part 1)
│   │   │   │   ├── rag/            # RagService (embed + index + retrieve) (Part 1)
│   │   │   │   ├── memory/         # AiMemoryService (long-term AI memory) (Part 1)
│   │   │   │   ├── scheduler/      # nightly daily-digest job (Part 1)
│   │   │   │   ├── workers/        # embedding backfill (Part 1)
│   │   │   │   ├── prompts/        # system prompts, prompt sanitizer (Part 1)
│   │   │   │   ├── tools/          # tool-registry types shared by agent-runner/assistant (Part 1)
│   │   │   │   ├── guards/         # AiAuthorizationGuard (irreversible-action protection) (Part 1)
│   │   │   │   ├── interceptors/   # SecretRedactionInterceptor (Part 1)
│   │   │   │   ├── features/       # Phase 11 Part 2 — FeatureStoreService, reusable feature vectors
│   │   │   │   ├── registry/       # Part 2 — ModelRegistryV2Service (deployment-stage lifecycle)
│   │   │   │   ├── models/         # Part 2 — feature-scoring.util.ts (weighted-sum + sigmoid)
│   │   │   │   ├── evaluation/     # Part 2 — metrics.util.ts (precision/recall/F1/ROC AUC/MAPE/RMSE/MAE)
│   │   │   │   ├── calibration/    # Part 2 — ConfidenceCalibratorService
│   │   │   │   ├── drift/          # Part 2 — DriftDetectionService (PSI-based)
│   │   │   │   ├── segmentation/   # Part 2 — ClusteringStrategy (rule-based + kmeans)
│   │   │   │   ├── prediction/     # Part 2 — CustomerPredictionService (8 explainable models)
│   │   │   │   ├── forecasting/    # Part 2 — ForecastingFacadeService
│   │   │   │   ├── training/       # Part 2 — RetrainingService + RetrainingScheduler
│   │   │   │   ├── approvals/      # Part 3 — Human Approval Layer (ApprovalService, executor registry)
│   │   │   │   ├── agents/         # Part 3 — 8 DomainAgents + CoordinatorAgentService (Multi-Agent AI)
│   │   │   │   ├── decision-engine/ # Part 3 — DecisionEngineService (Autonomous Decision Engine)
│   │   │   │   ├── copilot/        # Part 3 — CopilotService (5-step reasoning trace) + export utils
│   │   │   │   ├── knowledge-base/ # Part 3 — KnowledgeBaseService (AI Knowledge Base)
│   │   │   │   ├── workflows/      # Part 3 — WorkflowEngineService + AutomationService
│   │   │   │   ├── simulator/      # Part 3 — ScenarioSimulatorService + DigitalTwinService
│   │   │   │   ├── evaluation-tracker/ # Part 3 — EvaluationTrackerService (Continuous Evaluation)
│   │   │   │   ├── governance/     # Part 3 — PolicyEngineService + PromptRegistryService
│   │   │   │   ├── websockets/     # Part 3 — CopilotGateway (/ws/ai-copilot, step-level streaming);
│   │   │   │   │                   #   distinct from the top-level apps/api/src/websockets/ below
│   │   │   │   ├── dto/, entities/, events/, utils/
│   │   │   │   └── ai-intelligence.module.ts
│   │   │   ├── enterprise/         # Phase 12 — Enterprise & Global Restaurant Platform
│   │   │   │   │                   #   (sibling tree to modules/ and intelligence/ above)
│   │   │   │   ├── tenancy/        # TenantContextService/Guard, @CurrentOrganization()
│   │   │   │   ├── rbac/           # OrgRolesGuard — a second, additive OrgRole axis
│   │   │   │   ├── organizations/, regions/, franchises/, branch-groups/
│   │   │   │   ├── feature-flags/, global-config/, licensing/, onboarding/
│   │   │   │   ├── sso/            # OIDC (one provider, 4 issuers) + SAML 2.0
│   │   │   │   ├── scim/           # SCIM 2.0 user provisioning (functional subset)
│   │   │   │   ├── webauthn/       # hand-rolled CBOR/COSE — step-up MFA
│   │   │   │   ├── ip-allowlist/, device-trust/, sessions/, audit/
│   │   │   │   ├── currency/, tax/, localization/, pricing/, receipts/  # Part 3
│   │   │   │   ├── analytics/      # Part 4 — corporate/region/franchise rollups, forecast aggregation
│   │   │   │   └── enterprise.module.ts
│   │   │   ├── common/             # guards, interceptors, pipes, decorators
│   │   │   │   └── observability/  # Phase 12 Part 5 — RequestContextService (traceId),
│   │   │   │                       #   JsonLoggerService, MetricsService (/metrics)
│   │   │   ├── websockets/         # /ws/orders, /ws/delivery gateways
│   │   │   ├── queue/              # BullMQ processors
│   │   │   ├── config/             # env schema/validation
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── test/                   # integration tests (Testcontainers)
│   │   └── openapi.yaml            # generated + committed contract
│   │
│   ├── web/                        # Next.js — marketing site, customer portal, QR menu
│   │   ├── app/
│   │   │   ├── (marketing)/        # public site: home, story, locations
│   │   │   ├── (menu)/menu/        # browsable + QR-scanned menu, cart, checkout
│   │   │   ├── (account)/account/  # order history, addresses, loyalty
│   │   │   └── api/                # Next.js route handlers only for BFF concerns (e.g. image proxy)
│   │   └── components/
│   │
│   ├── admin/                      # Next.js — staff/owner dashboard
│   │   ├── app/
│   │   │   ├── orders/             # kitchen display + order management
│   │   │   ├── menu/               # catalog CRUD
│   │   │   ├── inventory/
│   │   │   ├── promotions/
│   │   │   ├── staff/
│   │   │   ├── analytics/
│   │   │   └── enterprise/         # Phase 12 — Organization/Regions/Franchises/Feature
│   │   │                           #   Flags/Licensing/SSO/Currency & Tax/Analytics
│   │   └── components/
│   │
│   ├── delivery/                   # Next.js PWA — rider app
│   │   ├── app/
│   │   │   ├── assignments/
│   │   │   ├── active-delivery/    # live map, status updates
│   │   │   └── history/
│   │   └── components/
│   │
│   └── mobile/                     # React Native (Expo) — Android + iOS, one codebase
│       ├── app/                    # expo-router screens
│       ├── components/
│       └── native/                 # platform-specific modules (push, biometrics)
│
├── packages/
│   ├── ui/                         # shared design system: tokens + components (web via Tailwind, mobile via NativeWind)
│   ├── api-client/                 # typed client generated from apps/api/openapi.yaml
│   ├── types/                      # shared domain types/enums not tied to the generated client
│   ├── config/                     # shared eslint, tsconfig, tailwind config
│   └── utils/                      # currency formatting, date/locale helpers, validation schemas
│
├── infra/
│   ├── docker/                     # Dockerfiles per app, docker-compose for local dev
│   ├── k8s/                        # Phase 12 Part 5 — base/ (Deployment/Service/HPA/PDB/
│   │   │                           #   Ingress), blue-green/, canary/ (see infra/k8s/README.md)
│   ├── observability/              # Prometheus scrape config, alert rules, OTel Collector
│   │   │                           #   config, Fluent Bit → Loki config
│   ├── backup/                     # nightly pg_dump CronJob + weekly automated restore-test
│   │   │                           #   CronJob (see infra/backup/README.md)
│   └── terraform/                  # AWS resources: VPC, RDS, ElastiCache, EKS, S3, CloudFront (planned, not yet written)
│
├── docs/                           # this directory
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_DESIGN.md
│   ├── FOLDER_STRUCTURE.md
│   ├── DESIGN_SYSTEM.md
│   ├── DEPLOYMENT.md
│   ├── ROADMAP.md
│   └── adr/                        # Architecture Decision Records, one file per significant decision
│
├── .github/workflows/              # fresh-cup-ci.yml (lint/typecheck/build/test),
│                                    #   fresh-cup-deploy.yml (Phase 12 — build/push image →
│                                    #   canary → manual soak gate → promote)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Ownership rules

- Only `apps/api` talks to PostgreSQL/Redis directly. No frontend app ever
  gets a database credential.
- `packages/api-client` is generated, not hand-edited — regenerating it is
  part of the API's CI pipeline whenever `openapi.yaml` changes.
- `packages/ui` has no app-specific business logic — it's pure
  presentation (buttons, cards, form fields, the brand's color/type tokens).
- Each `apps/*` package owns its routing, state, and page composition; cross-app
  reuse always goes through `packages/*`, never by importing across `apps/*`.
