# Fresh Cup Juice House — Digital Platform

Premium juice bar & healthy-food ordering ecosystem for **Fresh Cup Juice House**
(Merkato, American Gibi, Addis Ababa, Ethiopia).

This directory contains the architecture and planning artifacts for the full
platform: website, Android app, iOS app, admin dashboard, customer portal,
delivery dashboard, loyalty system, QR menu, inventory management, and
analytics — built as one coherent system rather than disconnected projects.

> **Status:** Phase 0 — Architecture & Planning. No application code has been
> generated yet by design (see the roadmap). This is intentional: a system
> this size gets one shot at its data model and API contracts before dozens
> of clients start depending on them.

## Start here

| Doc | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System overview, tech stack + rationale, domain boundaries, security, scalability, real-time architecture, observability |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | Full entity-relationship design and DDL sketch |
| [`docs/API_DESIGN.md`](docs/API_DESIGN.md) | REST + WebSocket API conventions and endpoint catalog |
| [`docs/FOLDER_STRUCTURE.md`](docs/FOLDER_STRUCTURE.md) | Monorepo layout for every app and shared package |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Brand identity, color system, typography, component tokens |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Infrastructure, environments, CI/CD pipeline |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phased implementation plan, phase 0 → phase 7 |

## Why a separate directory

This repository's existing history (`ai_brain/`, trading tests, etc.) belongs
to an unrelated forex/trading project. Fresh Cup lives entirely under
`fresh-cup-platform/` so the two are never entangled — nothing here imports
from, or is imported by, the trading codebase.
