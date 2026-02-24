# CodeQL Actions Artifact Poisoning - False Positive Analysis

## Summary

CodeQL raised `actions/artifact-poisoning` alerts against debug log steps in three workflow files. After analysis, these were determined to be **false positives** and the alerts should be dismissed in the GitHub Security UI.

## Affected Files

| File | Step Name |
|------|-----------|
| `.github/workflows/_ci-e2e.reusable.yml` | 🐛 Show Logs on Failure |
| `.github/workflows/_ci-e2e-tauri.reusable.yml` | 🐛 Debug Information |
| `.github/workflows/_ci-e2e-tauri-embedded.reusable.yml` | 🐛 Debug Information |

## The Alert

CodeQL flagged the pattern:
```yaml
run: pnpm exec tsx e2e/scripts/show-logs.ts
```

The concern: if a malicious artifact were downloaded and extracted to the workspace, it could potentially overwrite `e2e/scripts/show-logs.ts`, causing arbitrary code execution.

## Why This Is A False Positive

The artifact extraction logic in `.github/workflows/actions/download-archive/action.yml` has strict safeguards:

### 1. Extraction to Temporary Directory

Artifacts are first extracted to `${RUNNER_TEMP}/artifact-extract-{run_id}-{attempt}` - a per-job temp directory outside the workspace.

### 2. Whitelisted Directory Copy

The "Extract and Copy Archive" step only copies specific directories to the workspace:

```bash
# Lines 259-268: Only search for these specific directory names
for search_dir in "packages" "fixtures" "e2e"; do
  DIST_DIRS=$((DIST_DIRS + $(find "$SOURCE_DIR/$search_dir" -type d -path "*/dist" ...)))
  DIST_JS_DIRS=$((DIST_JS_DIRS + $(find "$SOURCE_DIR/$search_dir" -type d -name "dist-js" ...)))
  TARGET_DIRS=$((TARGET_DIRS + $(find "$SOURCE_DIR/$search_dir" -type d -name "target" ...)))
done
```

### 3. Copy Function Only Handles These Directories

The `copy_directory` function is only called for:
- `**/dist` directories
- `**/dist-js` directories  
- `**/target` directories

**It never copies `scripts/` directories.**

### Conclusion

Even if a malicious artifact contained a poisoned `e2e/scripts/show-logs.ts` file:
1. The artifact extracts to a temp directory
2. The copy logic only looks for `dist/`, `dist-js/`, and `target/`
3. The `scripts/` directory is never touched

The script at `e2e/scripts/show-logs.ts` can only come from the git checkout, never from an artifact.

## CodeQL's Limitation

CodeQL's `actions/artifact-poisoning` rule applies a blanket "defense in depth" analysis:
- It sees: "artifacts are downloaded" + "code is executed from workspace"
- It doesn't understand: the custom extraction logic that whitelists specific directories

This is a reasonable default for CodeQL to apply, but in this specific codebase with our custom `download-archive` action, the risk is mitigated by design.

## Decision

1. **Dismiss alerts** in GitHub Security UI as "False positive"
2. **Document rationale** in `.github/codeql/codeql-config.yml` for future reference
3. **Add comments** in workflow files explaining the false positive

## Alternative Approaches Considered

### 1. Inline Shell Script
Replace the TypeScript script with inline bash:
```yaml
run: |
  find e2e/logs -name '*.log' -type f | while read -r f; do
    echo "=== $f ==="
    cat "$f"
  done
```

**Pros:** No file execution, satisfies CodeQL
**Cons:** Duplicates logic across 3 files, loses shared script benefit, harder to maintain

### 2. Copy Script to Temp Directory
```yaml
run: |
  mkdir -p "${RUNNER_TEMP}/scripts"
  cp e2e/scripts/show-logs.ts "${RUNNER_TEMP}/scripts/"
  pnpm exec tsx "${RUNNER_TEMP}/scripts/show-logs.ts"
```

**Pros:** Satisfies CodeQL
**Cons:** Over-engineering for a non-existent threat, adds complexity

### 3. Hash Verification
Compute script hash at checkout, verify before execution.

**Cons:** Massive overkill for a false positive

## Final Implementation

Chose to keep the original script approach with documentation:

```yaml
# CodeQL false positive: This script cannot be poisoned by artifacts because
# download-archive/action.yml only extracts dist/, dist-js/, and target/ directories
# to the workspace - it never touches scripts/ directories.
- name: 🐛 Debug Information
  run: pnpm exec tsx e2e/scripts/show-logs.ts
```

This maintains the benefit of a shared, version-controlled script while documenting why the CodeQL alert is a false positive for future maintainers and security auditors.
