#!/usr/bin/env tsx

import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, '..');

async function main() {
  console.log('📝 Generating TypeScript declarations...');

  try {
    const guestJsPath = resolve(packageDir, 'guest-js', 'index.ts');
    const outDir = resolve(packageDir, 'dist-types');

    execSync(
      `tsc --declaration --emitDeclarationOnly --outDir "${outDir}" --declarationDir "${outDir}" --target ES2020 --module ESNext --moduleResolution node --skipLibCheck --noEmitOnError "${guestJsPath}"`,
      {
        cwd: packageDir,
        stdio: 'inherit',
      },
    );

    console.log('✅ TypeScript declarations generated');
    console.log('🎉 Build complete!');
  } catch (error) {
    console.error('❌ Type generation failed:', error);
    process.exit(1);
  }
}

main();
