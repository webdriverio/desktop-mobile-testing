# CodeQL Actions Artifact Poisoning - False Positive Analysis

## Summary

CodeQL raised `actions/artifact-poisoning` alerts against debug log steps and artifact download steps in workflow files. After analysis, these were determined to be **false positives** and the alerts are excluded via `codeql-config.yml`.

## Affected Files

| File | Step Name | Alert Type |
|------|-----------|------------|
| `.github/workflows/_ci-e2e.reusable.yml` | 🐛 Show Logs on Failure | Script execution |
| `.github/workflows/_ci-e2e-tauri.reusable.yml` | 🐛 Debug Information | Script execution |
| `.github/workflows/_ci-e2e-tauri-embedded.reusable.yml` | 🐛 Debug Information | Script execution |
| `.github/workflows/_ci-e2e-tauri-crabnebula.reusable.yml` | 🐛 Debug Information | Script execution |
| `.github/workflows/_ci-build-tauri-e2e-app.reusable.yml` | 📦 Install Dependencies | pnpm install after artifact download |

## Alert: Script execution after artifact download

### The Alert

CodeQL flagged the pattern:
```yaml
run: pnpm exec tsx e2e/scripts/show-logs.ts
```

The concern: if a malicious artifact were downloaded and extracted to the workspace, it could potentially overwrite `e2e/scripts/show-logs.ts`, causing arbitrary code execution.

### Why This Is A False Positive

The `download-archive` action (`.github/workflows/actions/download-archive/action.yml`) has strict safeguards:

#### 1. Extraction to Temporary Directory

Artifacts are first extracted to `${RUNNER_TEMP}/artifact-extract-{run_id}-{attempt}` - a per-job temp directory outside the workspace.

#### 2. Whitelisted Directory Copy

The "Extract and Copy Archive" step only copies specific directories to the workspace:

- `**/dist` directories (build output)
- `**/dist-js` directories (build output)
- `**/target` directories (Rust/Tauri build output)

**It never copies `scripts/` directories.**

### Conclusion

Even if a malicious artifact contained a poisoned `e2e/scripts/show-logs.ts` file:
1. The artifact extracts to a temp directory
2. The copy logic only looks for `dist/`, `dist-js/`, and `target/`
3. The `scripts/` directory is never touched

The script at `e2e/scripts/show-logs.ts` can only come from the git checkout, never from an artifact.

## Alert: pnpm install after artifact download

### The Alert

CodeQL flagged the `pnpm install --frozen-lockfile` step in `_ci-build-tauri-e2e-app.reusable.yml` after the `download-archive` action downloads artifacts.

The concern: if a malicious artifact overwrote `package.json`, `pnpm-lock.yaml`, or `.npmrc`, it could cause arbitrary code execution during install.

### Why This Is A False Positive

The `download-archive` action has multiple safeguards:

#### 1. Extraction to Temporary Directory

Artifacts are extracted to `${RUNNER_TEMP}/artifact-extract-{run_id}-{attempt}` - a per-job temp directory outside the workspace.

#### 2. Whitelisted Directory Copy

The action only copies these specific directories:
- `**/dist` directories (build output)
- `**/dist-js` directories (build output)
- `**/target` directories (Rust/Tauri build output)

**It never copies root-level files** like `package.json`, `pnpm-lock.yaml`, or `.npmrc`.

#### 3. pnpm Uses Workspace Root Files

`pnpm install` runs from the workspace root, which contains the git checkout. It uses:
- `package.json` from git checkout
- `pnpm-lock.yaml` from git checkout
- `.npmrc` from git checkout

These files are never overwritten by the artifact download.

### Conclusion

Even if a malicious artifact contained poisoned `package.json` or `pnpm-lock.yaml`:
1. The artifact extracts to a temp directory
2. The copy logic only looks for build output directories
3. Root-level config files are never touched

The `pnpm install` command only uses config files from the git checkout, never from artifacts.

## CodeQL's Limitation

CodeQL's `actions/artifact-poisoning` rule applies a blanket "defense in depth" analysis:
- It sees: "artifacts are downloaded" + "code is executed from workspace"
- It doesn't understand: the custom extraction logic that whitelists specific directories

This is a reasonable default for CodeQL to apply, but in this codebase with the custom `download-archive` action, the risk is mitigated by design.
