# electron-forge

An ESM project for a minimal Electron app, designed to provide E2E testing for `wdio-electron-service`.

The app is built using Electron Forge and both preload and main scripts are bundled. This is to avoid errors being thrown in the build step since Forge does not have good PNPM support.

**Note**: This E2E app uses ESM only. CJS/ESM module system testing is done in package tests (see `fixtures/package-tests/`).
