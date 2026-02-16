## Tech Stack

This document provides a quick reference for the tech stack. See [agent-os/product/tech-stack.md](../product/tech-stack.md) for detailed documentation.

### Framework & Runtime
- **Language:** TypeScript 5.9+
- **Runtime:** Node.js 18 LTS or 20 LTS
- **Package Manager:** pnpm 10.27.0+
- **Module System:** ESM with CJS dual build

### Monorepo
- **Build Tool:** Turborepo 2.5+
- **Workspaces:** pnpm workspaces

### Testing
- **Unit/Integration:** Vitest 3.2+
- **E2E:** WebdriverIO 9.0+
- **Coverage:** 80% minimum

### Code Quality
- **Formatter:** Biome 2.2.5
- **Linter:** Biome 2.2.5 + ESLint 9.37+
- **Pre-commit:** Husky 9.1+ with lint-staged

### CI/CD
- **Platform:** GitHub Actions
- **Release:** Automated via Turborepo

### Supported Frameworks
- **Electron:** `@wdio/electron-service` v10.x
- **Tauri:** `@wdio/tauri-service` v1.x

### Planned
- Dioxus, React Native, Flutter, Capacitor, Neutralino

See [ROADMAP.md](../../ROADMAP.md) for details.
