# ACM v1.0a Backend Modules

> AMB platform Custom App backend, scaffolded per Stage 2 design docs (`docs/design/acm-v1.0a-*`).

## Layout

```
backend/src/modules/
├── acm-common/        AES-GCM crypto, OwnEntityGuard, EventEmitter, CurrentUser decorator
├── acm-sch/           School master (S-01..S-31)
├── acm-ref/           Reference materials with per-update versioning (R-01..R-32)
├── acm-csl/           New consultations + state machine (C-01..C-41)
├── acm-qna/           Q&A with dual-tone editor (Q-01..Q-53)
├── acm-dsh/           KPI dashboard + cron snapshot job (D-01..D-33)
└── acm.module.ts      Aggregator
```

Each feature module follows Clean Architecture (ADR-001):
- `domain/` — pure entities + repository interfaces
- `application/` — use cases (services) + DTOs
- `infrastructure/typeorm/` — TypeORM entities + repository implementations
- `presentation/` — Controllers (HTTP)

## Wiring (next steps)

This skeleton is **not yet mounted** in `app.module.ts`. To activate:

1. **Install missing deps**
   ```bash
   cd backend
   pnpm add pg @nestjs/event-emitter
   # Optional (BullMQ migration per ADR-009)
   pnpm add bullmq @nestjs/bullmq
   ```

2. **Switch DB driver** (currently MySQL for legacy TAC). For ACM use PostgreSQL:
   ```ts
   // backend/src/app.module.ts — replace TypeOrmModule.forRootAsync
   type: 'postgres',
   host: config.get('PG_HOST', 'localhost'),
   port: config.get<number>('PG_PORT', 5432),
   username: config.get('PG_USERNAME', 'amb'),
   password: config.get('PG_PASSWORD'),
   database: config.get('PG_DATABASE', 'db_amb'),
   entities: [__dirname + '/modules/**/*.typeorm-entity{.ts,.js}'],
   ```
   ⚠️ This breaks legacy TAC modules (MySQL-based). Coordinate migration plan separately.

3. **Mount AcmModule**
   ```ts
   import { AcmModule } from './modules/acm.module';
   @Module({ imports: [..., AcmModule] })
   export class AppModule {}
   ```

4. **Add env vars** (`.env`)
   ```
   PG_HOST=localhost
   PG_PORT=5432
   PG_USERNAME=amb
   PG_PASSWORD=...
   PG_DATABASE=db_amb
   # 32-byte hex (e.g., openssl rand -hex 32)
   ACM_PII_KEY=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff
   ```

5. **Run DB migration**
   ```bash
   psql -d db_amb -f sql/acm/100-acm-v1.0a-init.sql
   ```

## What's NOT in this skeleton

- ❌ Unit/integration tests (see `acm-v1.0a-integration-test-001.md` for scenarios)
- ❌ AMB Core JWT integration (AuthGuard relies on a `req.user` shape — supply via AMB Core middleware)
- ❌ BullMQ migration of cron jobs (ADR-009 — currently uses `@nestjs/schedule`)
- ❌ Many endpoints from fn specs — only representative subset implemented per module
- ❌ Full state machine validations beyond CSL (QNA simplified, etc.)
- ❌ Dashboard KPI computation (job is empty stub)

## Per-module API Endpoints (skeleton)

| Module | Route prefix | Endpoints |
|---|---|---|
| SCH | `/acm/sch/schools` | POST, GET (list), GET autocomplete, GET/:id, PUT/:id, DELETE/:id |
| REF | `/acm/ref/references` | POST, GET (list), GET resolve, PUT/:id (versioned update) |
| CSL | `/acm/csl/consultations` | POST, GET (list), GET/:id, PUT/:id, PATCH/:id/status |
| QNA | `/acm/qna/questions` | POST, GET (list), GET/:id, PUT/:id, POST/:id/respond, PATCH/:id/status, PATCH/:id/faq |
| DSH | `/acm/dsh` | GET kpis, GET kpis/series |

All routes guarded by `OwnEntityGuard` (multi-tenancy via JWT-bound `entId`).

## References

- ERD: [acm-v1.0a-erd.md](../../../docs/design/acm-v1.0a-erd.md)
- ADRs: [acm-v1.0a-adr-001.md](../../../docs/design/acm-v1.0a-adr-001.md)
- OpenAPI: [acm-v1.0a-openapi-001.yaml](../../../docs/design/acm-v1.0a-openapi-001.yaml)
- Integration tests: [acm-v1.0a-integration-test-001.md](../../../docs/design/acm-v1.0a-integration-test-001.md)
