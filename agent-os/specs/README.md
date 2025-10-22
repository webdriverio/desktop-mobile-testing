# Specifications Directory

This directory contains detailed specifications for roadmap items.

## Current Specs (Synced with Roadmap v2)

### Active Specs

**Item #1: Monorepo Foundation with Electron Service** → `20251021-monorepo-with-electron/`
- **Status:** ✅ COMPLETE (combined from monorepo-foundation + electron-service-migration)
- **Spec ID:** 20251021-monorepo-with-electron
- **Effort:** Large (L), 4-5 weeks
- **Note:** Combines infrastructure setup with Electron migration for practical CI/CD

**Item #2: Shared Core Utilities** → `20251020-shared-core-utilities/`
- **Status:** ✅ COMPLETE
- **Spec ID:** 20251020-shared-core-utilities
- **Effort:** Medium (M), 3-4 weeks

**Item #3: Flutter Service** → `20251020-flutter-service/`
- **Status:** ✅ COMPLETE (updated for CI/CD)
- **Spec ID:** 20251020-flutter-service
- **Effort:** Large (L), 12-17 weeks
- **Note:** Includes CI/CD requirements (TR5)

**Items #4-9:** → _No specs yet (future work)_

---

## Legacy Specs (Superseded)

These specs are from roadmap v1 and have been superseded:

**OLD Item #1: Monorepo Foundation** → `20251020-monorepo-foundation/`
- **Status:** ❌ SUPERSEDED (combined with Item #2 into new Item #1)
- **Superseded by:** 20251021-monorepo-with-electron (to be created)
- **Keep for:** Historical reference, source material for combined spec
- **Notice:** See `SUPERSEDED.md` in spec directory for details

**OLD Item #2: Electron Service Migration** → `20251020-electron-service-migration/`
- **Status:** ❌ SUPERSEDED (combined with Item #1 into new Item #1)
- **Superseded by:** 20251021-monorepo-with-electron (to be created)
- **Keep for:** Historical reference, source material for combined spec
- **Notice:** See `SUPERSEDED.md` in spec directory for details

**OLD Item #4: Flutter Service Widget Testing** → _No spec exists_
- **Status:** ❌ REMOVED from v1.0 roadmap
- **Reason:** Advanced features (screenshot comparison, visual regression) belong in v1.1 or v2.0
- **Note:** Core Flutter commands (byValueKey, tap, scroll, etc.) already in Item #3

---

## Roadmap Version History

### V2 (Current) - 9 items
1. Monorepo Foundation with Electron Service `L`
2. Shared Core Utilities `M`
3. Flutter Service `L` (complete, includes all core features)
4. Neutralino Service `L` (combined foundation + advanced)
5. Tauri Service `L` (combined MVP + testing features)
6. Shared Test Utilities `M`
7. Advanced Features: Standalone/Multiremote `M`
8. Performance Optimization `M`
9. Community Growth `L`

### V1 (Original) - 13 items
1. Monorepo Foundation `M` → MERGED into V2 Item #1
2. Electron Service Migration `L` → MERGED into V2 Item #1
3. Shared Core Utilities `M` → V2 Item #2
4. Flutter Core Architecture `L` → V2 Item #3
5. Flutter Widget Testing `M` → REMOVED (post-release feature)
6. Neutralino Foundation `L` → MERGED into V2 Item #4
7. Neutralino Advanced Features `M` → MERGED into V2 Item #4
8. Tauri MVP `L` → MERGED into V2 Item #5
9. Tauri Testing Features `M` → MERGED into V2 Item #5
10. Cross-Service Testing `L` → REVISED to V2 Item #6 (focus changed)
11. Advanced Features `M` → V2 Item #7
12. Performance Optimization `M` → V2 Item #8
13. Community Growth `L` → V2 Item #9

**Key Changes:**
- Combined infrastructure + migration (practical approach)
- Combined service foundation + advanced features (complete deliverables)
- Removed Flutter Widget Testing (v1.1 feature)
- Reduced 13 items → 9 items

---

## Spec Naming Convention

**Format:** `YYYYMMDD-short-name/`

**Structure:**
```
YYYYMMDD-short-name/
├── planning/
│   ├── initialization.md       # Context, goals, dependencies
│   └── requirements.md          # Detailed requirements (FR, TR, NFR)
├── spec.md                      # Main specification
├── tasks.md                     # Task breakdown
├── verification/
│   └── spec-verification.md    # Verification report
└── [OPTIONAL FILES]
    ├── REVISIONS.md             # Change log
    ├── UPDATES.md               # Major updates log
    └── *.md                     # Additional documentation
```

---

## Spec Status Definitions

- ✅ **COMPLETE:** Spec written, verified, ready for implementation
- 🚧 **IN PROGRESS:** Spec being written
- ⏳ **PLANNED:** On roadmap, not yet started
- ❌ **SUPERSEDED:** Replaced by newer spec
- 🗑️ **REMOVED:** Removed from roadmap

---

## Next Steps

### Immediate (Before Implementation)

1. **Create combined spec for Item #1:**
   - Follow `/agent-os/specs/SPEC_COMBINATION_PLAN.md`
   - Create `20251021-monorepo-with-electron/`
   - Merge content from monorepo-foundation + electron-service-migration
   - Mark old specs as SUPERSEDED

2. **Update spec references:**
   - Add SUPERSEDED notice to old specs
   - Update cross-references in Flutter spec

### Future (As Needed)

3. **Create Item #4 spec (Neutralino Service):**
   - Combine foundation + advanced features
   - Include CI/CD requirements
   - Include test analysis phase

4. **Create Item #5 spec (Tauri Service):**
   - Combine MVP + testing features
   - Include CI/CD requirements
   - Include test analysis phase

5. **Create Item #6 spec (Shared Test Utilities):**
   - Extract patterns from Flutter/Neutralino/Tauri
   - Define @wdio/service-test-utils package

---

## Spec Directory Organization

**Current state:**
```
specs/
├── README.md (this file)
├── SPEC_COMBINATION_PLAN.md
├── 20251021-monorepo-with-electron/     ← Item #1 (active) ✅
├── 20251020-shared-core-utilities/      ← Item #2 (active)
└── 20251020-flutter-service/            ← Item #3 (active)
```

**Note:** Old superseded specs (`20251020-monorepo-foundation/` and `20251020-electron-service-migration/`) were removed after combined spec created. See git history if needed.

---

## Questions?

For spec-related questions:
- Review SPEC_COMBINATION_PLAN.md for Item #1 combination strategy
- Check roadmap.md for latest item numbering and descriptions
- Consult existing specs for format and structure examples
