# Development

## Prerequisites

Development and building the service locally requires [Node.JS](https://nodejs.org) (>= 18) with [PNPM](https://pnpm.io) as a package manager -- and Git, obviously.

To start with development, use e.g. [NVM](https://github.com/nvm-sh/nvm) to install an appropriate version of NodeJS, then [install PNPM](https://pnpm.io/installation). Once that is done you can check out the repo with git, and install the dependencies with PNPM.

[Husky](https://typicode.github.io/husky/) is used for git commit hooks in combination with [`lint-staged`](https://github.com/lint-staged/lint-staged).
[Turborepo](https://turbo.build) is used to handle builds and testing.

## Dependency Management

The project uses a catalog system to manage dependencies across all packages. There are three catalogs:

1. **`default`**: Production-ready configuration using stable versions
   - Example: `electron: "catalog:default"` (resolves to version ^32.0.1)
   - Provides a reliable, well-tested baseline

2. **`next`**: Forward-looking configuration with latest versions
   - Example: `electron-nightly: "catalog:next"` (latest nightly builds)
   - Validates compatibility with upcoming changes

3. **`minimum`**: Lowest supported versions
   - Example: `electron: "catalog:minimum"` (version ^28.0.0)
   - Ensures backward compatibility

### Switching Catalogs

To switch all packages to use a specific catalog:

```bash
# Switch to default catalog (stable versions)
pnpm catalog:default

# Switch to next catalog (latest/nightly versions)
pnpm catalog:next

# Switch to minimum catalog (lowest supported versions)
pnpm catalog:minimum
```

### Updating Catalog Versions

To update the versions in a catalog:

```bash
# Update a specific catalog
pnpm catalog:update

# Preview changes without applying them
pnpm catalog:update:dry

# Update all catalogs and other dependencies
pnpm update:all
```

You can also specify the catalog directly using shortcuts:

```bash
pnpm catalog:update --default  # Update default catalog
pnpm catalog:update --next     # Update next catalog
pnpm catalog:update --minimum  # Update minimum catalog
```

The update process will:

1. Show available updates for all packages in the selected catalog
2. Allow you to select which packages to update
3. Update the versions in the workspace file
4. Run `pnpm install` to apply the changes

For the `next` catalog specifically, the update process will:

- Fetch the latest electron-nightly version from npm
- Set other packages to use the most appropriate tag:
  - Checks all available tags (next, beta, alpha, latest)
  - Compares full semantic versions to find the highest version across all tags
  - Prioritizes cutting-edge tags in order: next > beta > alpha > latest
- Remove the electron dependency since only electron-nightly is used in this catalog

## Rebuilding on file changes

During development, it is helpful to rebuild files as they change, with respect to all packages. To do this, run the dev script in a new terminal:

```bash
pnpm dev
```

Alternatively, you can run it for each individual package.
For example, run the dev script for `@wdio/electron-utils` in a new terminal:

```bash
pnpm dev --filter "@wdio/electron-utils"
```

## Testing - E2Es

E2E tests can be run locally via:

```bash
pnpm test:e2e-local
```

```bash
pnpm test:e2e-mac-universal-local
```

Below are the task graphs for the E2Es:

![E2E Task Graph](../.github/assets/e2e-graph.png 'E2E Task Graph')

![Mac Universal E2E Task Graph](../.github/assets/e2e-graph-mac-universal.png 'Mac Universal E2E Task Graph')

Note: The E2E runner logs are saved per run in the configured `outputDir` and include service namespaces (e.g., `wdio-electron-service:service`). Enable debug output for all namespaces by setting `DEBUG=wdio-electron-service:*`.

All E2E test applications use [electron-vite](https://electron-vite.org) for modern development and building.

## Testing - Units

Unit tests (using [Vitest](https://vitest.dev/)) can be run via:

```bash
pnpm test:unit
```

...in the root to run all of the tests for each package, OR

```bash
pnpm test:dev
```

...in each package directory to run tests in watch mode.

## Updating Dependencies

Dependencies can be updated interactively via:

```bash
pnpm update:interactive
```

and

```bash
pnpm update:interactive:dry
```

for a dry run.

## Updating E2E Task Graphs

Task graphs can be updated by running:

```bash
pnpm graph
```

## Formatting & Linting

The repo uses [Biome](https://biomejs.dev) for formatting and primary lint checks, alongside ESLint for additional rules.

- Format all files:

```bash
pnpm format
```

- Check formatting only (no writes):

```bash
pnpm format:check
```

- Lint (Biome + ESLint):

```bash
pnpm lint
```

- Lint with fixes:

```bash
pnpm lint:fix
```

## Contributing

Check the issues or [raise a new one](https://github.com/webdriverio/desktop-mobile/issues/new) for discussion:

**[Help Wanted Issues](https://github.com/webdriverio/desktop-mobile/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22help+wanted%22)**
**[Good First Issues](https://github.com/webdriverio/desktop-mobile/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22good+first+issue%22)**

## Release

Project maintainers can publish a release or pre-release of the npm package by manually running the [`Manual NPM Publish`](https://github.com/webdriverio/desktop-mobile/actions/workflows/release.yml) GitHub workflow. They will choose the release type to trigger a `major` , `minor`, or `patch` release following [Semantic Versioning](https://semver.org/), or a pre-release.

For detailed information about our release management process, including milestone structure, labeling system, and workflow, see the [Release Management](./release-management.md) documentation.

### Publish a Release

## Release Process

Project maintainers can publish releases using GitHub Actions workflows. The project follows a feature branch strategy with three main branch types, e.g.

- `main` - current stable version (e.g., v8.x)
- `feature/v9` - next major version development (e.g. v9.0.0-next.0)
- `v7.x` - maintenance/LTS branch

### Publishing Pre-releases

To publish a pre-release, run the [pre-release workflow](https://github.com/webdriverio/desktop-mobile/actions/workflows/pre-release.yml):

1. Select the branch:
   - `feature` for next major (automatically resolves to current feature branch, e.g., feature/v9)
   - `main` for current version pre-releases
2. Choose the pre-release type:
   - `prepatch` - e.g., 8.2.4-alpha.0
   - `preminor` - e.g., 8.3.0-alpha.0
   - `premajor` - e.g., 9.0.0-alpha.0
   - `prerelease` - increment alpha/beta number
3. Optionally enable dry-run mode to preview the changes

### Publishing Releases

To publish a release, run the [release workflow](https://github.com/webdriverio/desktop-mobile/actions/workflows/release.yml):

1. Select the branch:
   - `main` for current stable releases
   - `feature` for major version releases (automatically resolves to current feature branch)
   - `maintenance` for LTS releases (automatically resolves to current maintenance branch)
2. Choose the release type:
   - `patch` for bug fixes
   - `minor` for new features
   - `major` for breaking changes (only allowed from feature branch)
3. Optionally enable dry-run mode to preview the changes

### Major Version Releases

When releasing a new major version (e.g., v9.0.0):

1. Ensure all changes are ready in the feature branch
2. Run the release workflow with:
   - Branch: `feature`
   - Release type: `major`
3. This will automatically:
   - Create maintenance branch for current version (e.g., `v8.x`)
   - Update dependabot configuration
   - Archive old maintenance branch
   - Merge feature branch to main
   - Create GitHub release

### Maintenance Policy

This repository does not maintain LTS or maintenance branches. Each major version receives updates only while it is the current stable version on the `main` branch. Users requiring long-term support should pin to specific versions in their package.json.
