# Spec Initialization

**Spec Name:** Shared Core Utilities Package
**Date:** 2025-10-20
**Source:** Product Roadmap Item #3
**Priority:** High (Enables code reuse for Items #4-9)

## Context

This is the third implementation spec derived from the product roadmap. It extracts common functionality from the migrated Electron service into a shared utilities package that can be reused across Flutter, Neutralino, and Tauri services.

## Roadmap Reference

**Item #3:** Shared Core Utilities Package

**Sizing:** M (Medium)

**Description from Roadmap:**
> Create `@wdio/native-utils` package extracting common functionality from electron service (binary path resolution, service lifecycle, window management abstractions, configuration parsing) that can be reused across all framework services.

## Related Documentation

- Product Roadmap: `/agent-os/product/roadmap.md`
- Tech Stack: `/agent-os/product/tech-stack.md`
- Cross-Framework Analysis: `/agent-os/product/cross-framework-analysis.md`
- Previous Spec: Item #2 Electron Service Migration

## Dependencies

**Upstream:**
- ✅ Item #1: Monorepo Foundation (MUST be complete)
- ✅ Item #2: Electron Service Migration (MUST be complete - source of code to extract)

**Downstream:**
- Item #4: Flutter Service (will use shared utilities)
- Item #5-9: All other service implementations (will use shared utilities)

## Success Criteria

From roadmap:
- ✅ `@wdio/native-utils` package created
- ✅ Common functionality extracted from Electron service
- ✅ Binary path resolution utilities
- ✅ Service lifecycle abstractions
- ✅ Window management abstractions
- ✅ Configuration parsing utilities
- ✅ Usable by Flutter, Neutralino, Tauri services
- ✅ 80%+ test coverage
- ✅ Well-documented for reuse
