# Spec Initialization

**Spec Name:** Monorepo Foundation with Electron Service
**Date:** 2025-10-21
**Source:** Product Roadmap Item #1 (combined from old Items #1 and #2)
**Priority:** High (Foundation for all other work)

## Context

This is the first implementation spec derived from the product roadmap V2. It establishes the foundational monorepo structure **while simultaneously** migrating the Electron service from its standalone repository as the first package.

**Key Insight:** You can't set up meaningful CI/CD without code to test. This combined approach allows infrastructure decisions to be informed by actual requirements (Electron's multi-platform testing, E2E test needs, coverage thresholds).

## Roadmap Reference

**Item #1:** Monorepo Foundation with Electron Service

**Sizing:** L (Large) - Combined effort from separate M and L items

**Description from Roadmap:**
> Establish monorepo workspace (pnpm, Turborepo, shared configs) while migrating Electron service from standalone repository as the first package. Ensure all existing features work (binary detection, main process access via CDP, API mocking, window management), maintain 80%+ test coverage. Set up CI/CD pipeline based on Electron's actual testing requirements (package tests, E2E tests, multi-platform matrix). Establish package structure conventions and build patterns for future services.

## Why Combined?

**Original Approach (Roadmap V1):**
- Item #1: Set up monorepo infrastructure + CI/CD
- Item #2: Migrate Electron service

**Problems:**
- CI/CD would be set up without real code to validate it
- Infrastructure decisions made without knowing actual requirements
- Electron's testing needs (multi-platform matrix, E2E tests, coverage) unknown during setup
- Two separate deliverables when they should be one

**New Approach (Roadmap V2):**
- Combined Item #1: Monorepo Foundation **with** Electron Service
- Set up infrastructure **alongside** migration
- CI/CD based on Electron's **actual** testing requirements
- Infrastructure validated **immediately** with real code

**Result:**
- Single deliverable: "working monorepo with validated reference implementation"
- Faster implementation (no context switching)
- Better CI/CD (based on real needs, not guesswork)

## Related Documentation

- Product Roadmap: `/agent-os/product/roadmap.md` (V2)
- Tech Stack: `/agent-os/product/tech-stack.md`
- Cross-Framework Analysis: `/agent-os/product/cross-framework-analysis.md` (Electron section)
- Spec Combination Plan: `/agent-os/specs/SPEC_COMBINATION_PLAN.md`
- Roadmap Changes: `/agent-os/ROADMAP_V2_CHANGES.md`

## Source Materials

This spec combines content from two superseded specs:

**Source #1:** `20251020-monorepo-foundation/` (OLD Item #1)
- Monorepo workspace setup
- Turborepo configuration
- Shared TypeScript configurations
- Package structure conventions
- Basic CI/CD scaffolding

**Source #2:** `20251020-electron-service-migration/` (OLD Item #2)
- Electron service migration strategy
- Package breakdown (5 packages)
- Feature preservation requirements
- Test migration approach
- Multi-platform CI/CD requirements

See `COMBINATION_NOTES.md` in this spec directory for merge details.

## Reference Implementation

**wdio-electron-service repository:** `/Users/sam/Workspace/wdio-electron-service`

This repository serves as:
- Source for migration (code, tests, example apps, fixtures)
- Reference for package structure patterns
- Reference for build configuration
- Reference for CI/CD workflows

## Dependencies

**Upstream:**
- None (this is the foundation)

**Downstream:**
- Item #2: Shared Core Utilities Package (will extract from Electron service)
- Item #3: Flutter Service (will follow established patterns)
- Items #4-9: All subsequent services (will use as reference)

**Parallel Development:**
- None (all other items depend on this foundation)

## Platform Scope

**Target Platforms:**
- **Linux:** Ubuntu (latest)
- **Windows:** Windows (latest)
- **macOS:** macOS (latest)

**CI/CD Matrix:**
All platforms must be tested in CI for Electron service validation.

## Success Criteria

From roadmap and combination plan:

### 1. Monorepo Functional
- ✅ pnpm workspace configured and working
- ✅ Turborepo pipeline executing
- ✅ Shared configs (TypeScript, Biome, ESLint) in use
- ✅ Package structure conventions documented

### 2. Electron Service Migrated
- ✅ All 5 packages migrated to monorepo
- ✅ All existing features working (binary detection, CDP bridge, API mocking, window management)
- ✅ 80%+ test coverage maintained
- ✅ Example applications functional

### 3. CI/CD Operational
- ✅ Multi-platform testing (ubuntu, windows, macos)
- ✅ Package tests running
- ✅ E2E tests running
- ✅ Coverage reporting
- ✅ Turborepo caching working

### 4. Reference Quality
- ✅ Well-documented patterns
- ✅ Ready for other services to follow
- ✅ CI patterns established for Flutter/Neutralino/Tauri

### 5. Ready for Item #2
- ✅ Shared utilities can be extracted
- ✅ Flutter service can follow established patterns

## Timeline

**Estimated Effort:** 4-5 weeks

**Phase Breakdown:**
- Phase 1: Monorepo Scaffolding (Week 1) - 5-7 days
- Phase 2: Electron Service Migration (Weeks 2-4) - 15-21 days
  - Week 2: Utils and CDP bridge migration (5-7 days)
  - Week 3: Service migration (5-7 days)
  - Week 4: Integration and validation (3-5 days)
- Phase 3: CI/CD Integration (Week 5) - 5-7 days

**Rationale:**
- Week 1: Establish monorepo structure (pnpm, Turborepo, shared configs)
- Weeks 2-4: Migrate Electron packages incrementally, validate features
- Week 5: Set up CI/CD based on Electron's actual testing requirements
- Infrastructure validated with real code throughout

## Deliverables

**Code:**
- Monorepo workspace structure
- 5 Electron packages migrated
- Example applications migrated
- E2E test fixtures migrated

**Infrastructure:**
- Turborepo configuration
- Shared TypeScript configurations
- Code quality tool configurations
- CI/CD workflows (GitHub Actions)

**Documentation:**
- Monorepo setup guide
- Package structure conventions
- Migration patterns for future services
- CI/CD patterns documentation

**Tests:**
- All package tests migrated and passing
- All E2E tests migrated and passing
- 80%+ coverage maintained
- Multi-platform CI validation
