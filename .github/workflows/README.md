# GitHub Actions Workflows

This directory contains the CI/CD workflows for the WebDriverIO Desktop & Mobile Testing repository.

## Release Infrastructure

The release infrastructure is designed to support **independent versioning** of services and shared packages with **service-grouped releases**.

### Overview

- **Services**: Electron (v10.x) and Tauri (v1.x) maintain separate version histories
- **Shared Packages**: `@wdio/native-utils` and `@wdio/native-types` maintain their own semantic versioning
- **Two-Phase Versioning**: Shared packages are versioned first, then service packages
- **Automatic Detection**: Changed shared packages are detected via git diff and conventional commits

### Manual Trigger Workflows

These workflows are manually triggered from the GitHub Actions UI:

#### `release.yml` - Stable Releases

Release stable versions of either service.

**Service options:**
- `electron` - Releases `@wdio/electron-service`, `@wdio/electron-cdp-bridge`, `@wdio/bundler`
- `tauri` - Releases `@wdio/tauri-service`, `@wdio/tauri-plugin` (NPM + crates.io)

**Version options:** `patch`, `minor`, `major`

**Branch options:**
- `main` - Release from main branch
- `feature` - Release from a feature branch (branch name required)
- `maintenance` - Release from a maintenance branch (calculated automatically)

**Additional options:**
- `feature_branch_name` - Feature branch name (required when branch = "feature")
- `dry_run` - Preview changes without publishing (default: `false`)

#### `pre-release.yml` - Pre-releases

Release pre-release versions of either service.

**Service options:**
- `electron` - Pre-release Electron service packages
- `tauri` - Pre-release Tauri service packages (NPM + crates.io)

**Version options:** `prepatch`, `preminor`, `premajor`, `prerelease`

**Branch options:**
- `main` - Release from main branch
- `feature` - Release from a feature branch (branch name required)
- `maintenance` - Release from a maintenance branch (calculated automatically)

**Additional options:**
- `feature_branch_name` - Feature branch name (required when branch = "feature")
- `dry_run` - Preview changes without publishing (default: `false`)

**Additional options:**
- `dry_run` - Preview changes without publishing (default: `false`)

**Note:** Pre-releases publish to NPM with the `next` tag instead of `latest` and use `next` as the pre-release identifier (configured in `version.config.json`).

## Branch Behavior

The release workflows support three branch types with intelligent branch resolution:

### **`main`** Branch
- **Behavior**: Uses the `main` branch directly
- **Use case**: Standard releases from the main development branch
- **Validation**: No special restrictions

### **`feature`** Branch
- **Behavior**: Uses the **exact branch name** specified in `feature_branch_name`
- **Use case**: Releases from feature branches (required for major/premajor releases)
- **Validation**:
  - ✅ Required for **major** and **premajor** releases
  - ❌ Fails if specified branch doesn't exist
- **Examples**:
  - `feature_branch_name = "breaking-changes-v2"` → uses `breaking-changes-v2`
  - `feature_branch_name = "feature/new-api"` → uses `feature/new-api`

### **`maintenance`** Branch
- **Behavior**: **Calculated automatically** as `v{previous_major}.x` (e.g., if current version is 10.x, maintenance is v9.x)
- **Use case**: Patch releases for older versions from maintenance branches
- **Validation**: Calculated branch must exist on remote
- **Availability**: Only available after releasing the next major version
- **Examples**:
  - Current version: `10.0.0` → uses `v9.x` branch (after v10.0.0 is released)
  - Current version: `2.1.0` → uses `v1.x` branch (after v2.0.0 is released)
- **Note**: For new services starting at v1.0/v10.0, maintenance branches won't be available until after the first major version release

### Reusable Workflows

The release process is orchestrated through four reusable workflows:

#### `_release-orchestration.reusable.yml`

The main orchestrator that validates inputs and coordinates all release phases.

**Responsibilities:**
- Validate repository (must be `webdriverio-community/wdio-desktop-mobile-testing`)
- Validate service and release version inputs
- Coordinate the three-phase release process

**Inputs:**
- `service`: `electron` or `tauri`
- `branch`: `main`, `feature`, `maintenance`, or explicit branch name
- `release_version`: Version bump type (e.g., `patch`, `minor`, `prerelease`)
- `dry_run`: Show what would happen without publishing (default: `false`)

#### `_release-prepare.reusable.yml`

Phase 1: Calculate versions and detect changes.

**Responsibilities:**
- Determine target branch from input
- Validate release parameters (e.g., major releases must be from feature branches)
- Analyze git history to detect shared package changes
- Use conventional commits to determine bump types for shared packages
- Calculate all version numbers

**Outputs:**
- `target_branch`: Resolved branch name
- `service_version`: Calculated service version
- `service_package_list`: Comma-separated service packages
- `shared_packages_changed`: Whether shared packages have changes
- `shared_package_list`: Comma-separated changed shared packages
- `shared_version_native_utils`: New version for native-utils (if changed)
- `shared_version_native_utils_bump`: Bump type for native-utils
- `shared_version_native_types`: New version for native-types (if changed)
- `shared_version_native_types_bump`: Bump type for native-types

#### `_release-publish.reusable.yml`

Phase 2: Version packages and publish to registries.

**Responsibilities:**
- Run `package-versioner` in two phases:
  1. **Phase 1**: Version shared packages (if changed)
  2. **Phase 2**: Version service packages (updates dependencies on shared packages)
- Build all packages
- Publish to NPM with appropriate tags (`latest` or `next`)
- Publish Rust crates to crates.io (Tauri only)
- Push git tags and commits

**Outputs:**
- `service_release_tag`: The service release tag (e.g., `electron-service-v10.1.0`)
- `shared_release_tags`: Comma-separated shared package tags (e.g., `native-utils-v1.2.0,native-types-v2.1.0`)

#### `_release-post.reusable.yml`

Phase 3: Create GitHub releases.

**Responsibilities:**
- Create draft GitHub releases for:
  - Service packages (with combined changelog)
  - Individual shared packages (if changed)
- Mark releases as pre-release if applicable
- Provide next steps for manual review and publication

### Scripts

The workflows use TypeScript and Bash scripts for complex operations:

#### `calculate-version.ts`

Analyzes git history and calculates versions for all packages.

**Key Features:**
- Detects changes in shared packages using `git diff` since last tag
- Analyzes conventional commit messages to determine bump types:
  - `BREAKING CHANGE:` or `!:` → `major`
  - `feat(...):` → `minor`
  - `fix(...):` or other changes → `patch`
- Runs `package-versioner` in dry-run mode to calculate versions
- Outputs all version information to `GITHUB_OUTPUT`

**Environment Variables:**
- `INPUT_SERVICE`: `electron` or `tauri`
- `INPUT_RELEASE_VERSION`: Version bump type
- `INPUT_DRY_RUN`: Dry run mode
- `GITHUB_WORKSPACE`: Workspace root path

#### `publish-npm.ts`

Publishes packages to NPM.

**Key Features:**
- Iterates through a list of package names
- Skips private packages
- Uses `pnpm --filter` for targeted publishing
- Handles already-published packages gracefully
- Publishes with appropriate tags (`latest` or `next`)

**Environment Variables:**
- `INPUT_PACKAGE_LIST`: Comma-separated package names
- `INPUT_NPM_TAG`: NPM dist-tag (`latest` or `next`)
- `INPUT_DRY_RUN`: Dry run mode

#### `publish-crates.sh`

Publishes the Tauri plugin Rust crate to crates.io.

**Key Features:**
- Checks if version already exists on crates.io
- Skips publishing if already published
- Supports dry-run mode
- Uses `cargo publish` with authentication token

**Environment Variables:**
- `INPUT_CRATES_IO_TOKEN`: crates.io API token
- `INPUT_DRY_RUN`: Dry run mode

### Git Tagging Strategy

Each package maintains its own git tags:

- Service packages: `<service>-service-v<version>` (e.g., `electron-service-v10.1.0`)
- Other service packages: `<package-name>-v<version>` (e.g., `bundler-v3.2.0`)
- Shared packages: `native-<type>-v<version>` (e.g., `native-utils-v1.2.0`)

### Required Secrets

The following secrets must be configured in the repository:

#### `GITHUB_TOKEN`
- **Type**: GitHub token
- **Usage**: Creating GitHub releases, pushing tags
- **Note**: Automatically provided by GitHub Actions

#### `NPM_TOKEN`
- **Type**: NPM authentication token
- **Usage**: Publishing packages to NPM registry
- **Required for**: All releases
- **How to obtain**:
  1. Log in to npmjs.com
  2. Go to Account Settings → Access Tokens
  3. Generate a new token with "Automation" type
  4. Add as a repository secret

#### `DEPLOY_KEY`
- **Type**: SSH private key
- **Usage**: Pushing commits and tags to the repository
- **Required for**: All releases (non-dry-run)
- **How to obtain**:
  1. Generate an SSH key pair: `ssh-keygen -t ed25519 -C "github-actions-deploy"`
  2. Add the public key to repository Deploy Keys (Settings → Deploy Keys)
  3. Add the private key as a repository secret

#### `CRATES_IO_TOKEN`
- **Type**: crates.io API token
- **Usage**: Publishing Rust crates to crates.io
- **Required for**: Tauri releases only
- **How to obtain**:
  1. Log in to crates.io
  2. Go to Account Settings → API Tokens
  3. Generate a new token
  4. Add as a repository secret

### Release Process

#### 1. Prepare for Release

- Ensure all changes are merged to the target branch
- Review commit messages follow conventional commits format
- Consider which service to release (Electron or Tauri)

#### 2. Trigger Release Workflow

1. Go to Actions tab in GitHub
2. Select the appropriate workflow:
   - Stable: `Release`
   - Pre-release: `Pre-release`
3. Click "Run workflow"
4. Configure inputs:
   - **Service**: Select `electron` or `tauri`
   - **Branch**: Select `main`, `feature`, or `maintenance`
   - **Feature Branch Name**: (required when Branch = "feature") Exact branch name to release from
   - **Release Version**: Select bump type (e.g., `minor`, `prerelease`)
   - **Dry Run**: ✅ Recommended for first run to verify changes

#### 3. Review Dry Run Output

- Check the workflow logs for calculated versions
- Verify which packages will be updated
- Confirm shared packages are correctly detected
- Review changelog entries

#### 4. Execute Real Release

- Re-run the workflow with **Dry Run** unchecked
- Monitor the workflow execution
- Verify successful publishing to NPM and/or crates.io

#### 5. Publish GitHub Releases

- The workflow creates **draft** releases
- Review the automatically generated release notes
- Edit release notes as needed
- Publish each release

#### 6. Post-Release

- Verify packages are available on NPM: `npm view @wdio/<package>`
- Verify Rust crate (Tauri): `cargo search wdio-tauri-plugin`
- Update documentation if needed
- Announce the release

### Examples

#### Example 1: Patch Release for Electron Service

**Scenario**: Bug fix in `electron-service`, no shared package changes.

**Workflow**: `Release`

```yaml
Service: electron
Branch: main
Release Version: patch
Dry Run: false
```

**Result**:
- `@wdio/electron-service`: `10.0.0` → `10.0.1`
- `@wdio/electron-cdp-bridge`: `10.0.0` → `10.0.1` (grouped)
- `@wdio/bundler`: `3.0.0` → `3.0.1` (grouped)
- Tag: `electron-service-v10.0.1`

#### Example 2: Minor Release with Shared Package Changes

**Scenario**: New feature in `tauri-service`, also added utility to `native-utils`.

**Workflow**: `Release`

```yaml
Service: tauri
Branch: main
Release Version: minor
Dry Run: false
```

**Result**:
- `@wdio/native-utils`: `1.0.0` → `1.1.0` (detected via conventional commits)
- `@wdio/tauri-service`: `1.0.0` → `1.1.0`
- `@wdio/tauri-plugin`: `1.0.0` → `1.1.0` (NPM + crates.io)
- Tags: `native-utils-v1.1.0`, `tauri-service-v1.1.0`

#### Example 3: Pre-release from Feature Branch

**Scenario**: Testing breaking changes for Electron service from a specific feature branch.

**Workflow**: `Pre-release`

```yaml
Service: electron
Branch: feature
Feature Branch Name: breaking-api-changes
Release Version: premajor
Dry Run: false
```

#### Example 4: Maintenance Release (Future Use)

**Scenario**: Patch release for Electron service from a maintenance branch (calculated automatically).

**Workflow**: `Release`

```yaml
Service: electron
Branch: maintenance
Release Version: patch
Dry Run: false
```

*Note: This will only work after releasing v11.0.0+, at which point it will automatically use the `v10.x` branch for patches to the v10.x series.*

**Result**:
- `@wdio/electron-service`: `10.0.0` → `11.0.0-beta.0`
- Published to NPM with `next` tag
- Tag: `electron-service-v11.0.0-beta.0`
- GitHub release marked as pre-release

### Troubleshooting

#### Workflow fails at "Validate repository"

**Cause**: Workflow is running in a forked repository.

**Solution**: Release workflows are restricted to the main repository (`webdriverio-community/wdio-desktop-mobile-testing`).

#### Branch validation fails

**Cause**: Specified or calculated branch doesn't exist.

**Solutions**:
- **For feature branches**: Ensure the branch specified in `feature_branch_name` exists and is pushed to remote
- **For maintenance branches**: The branch name is calculated as `v{previous_major}.x`. For new services, maintenance branches won't exist until after the first major version release
- **Branch naming**: Feature branches use exact names; maintenance branches follow `v{major}.x` convention
- **Push branches**: Make sure branches are pushed to the remote repository before running releases

#### Maintenance branch not available

**Cause**: Trying to use maintenance releases for new services that haven't released their first major version yet.

**Solutions**:
- **Wait for major release**: Maintenance branches become available after releasing v2.0.0 (Tauri) or v11.0.0 (Electron)
- **Create manually if needed**: You can create maintenance branches proactively by branching from the commit before a major version release
- **Use main/feature branches**: For now, use `main` or `feature` branches for all releases

#### Shared package changes not detected

**Cause**: No git tag exists for the shared package.

**Solution**: The first release of a shared package is always considered "changed". Ensure proper tagging in subsequent releases.

#### Version calculation shows unexpected bump type

**Cause**: Conventional commit messages may not match expected patterns.

**Solution**: Review commit messages since the last tag:
```bash
git log <last-tag>..HEAD --oneline --no-merges -- packages/<package-name>
```

Ensure commits follow conventional commits format:
- `feat:` for features (minor bump)
- `fix:` for bug fixes (patch bump)
- `BREAKING CHANGE:` or `!:` for breaking changes (major bump)

#### NPM publish fails with "already published"

**Cause**: The version already exists on NPM.

**Solution**: The workflow detects this and continues. If needed, bump the version again or manually verify on npmjs.com.

#### Crates.io publish fails

**Cause**: Invalid `CRATES_IO_TOKEN` or version already published.

**Solution**:
1. Verify the token is valid and has write permissions
2. Check if the version exists: `cargo search wdio-tauri-plugin`
3. Regenerate the token if necessary

### CI/CD Best Practices

1. **Always use dry run first**: Verify calculated versions and changes before publishing
2. **Use conventional commits**: Ensures correct version bumps for shared packages
3. **Feature branches for major versions**: Major releases should come from feature branches
4. **Pre-releases for testing**: Use beta/alpha releases to test breaking changes
5. **Review draft releases**: Edit and improve release notes before publishing
6. **Monitor workflows**: Check workflow logs for any warnings or errors
7. **Verify published packages**: Confirm packages are accessible after release

### Architecture Decisions

#### Why Independent Versioning for Shared Packages?

- **Clearer History**: Each package has its own semantic version history
- **Avoid Downgrades**: Service releases won't accidentally downgrade shared packages
- **Better Dependency Management**: Consumers can track shared package versions independently
- **Flexibility**: Shared packages can be released with either service

#### Why Two-Phase Versioning?

- **Dependency Correctness**: Service packages always reference the latest shared package versions
- **Atomic Updates**: All version updates happen in a single commit
- **Simplified Rollback**: One commit contains all version changes for a release

#### Why Service-Grouped Releases?

- **User Clarity**: Users understand "Electron v10.1.0" vs individual package versions
- **Simplified Installation**: All service packages match versions (easier to troubleshoot)
- **Coordinated Releases**: Related packages are always released together

## Other Workflows

### CI Workflows

- **`ci.yml`** - Main CI pipeline (build, test, lint)
- **`test-tauri-webkit-e2e.yml`** - E2E tests for Tauri WebKitWebDriver
- Additional test workflows as needed

For information on these workflows, see their individual documentation.
