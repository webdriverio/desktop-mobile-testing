#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bundlerDist = __dirname + '/../../bundler/dist/cli.js';

async function main() {
  console.log('🔨 Building Tauri plugin JS...');

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('node', [bundlerDist, 'build:browser'], {
        cwd: __dirname + '/..',
        stdio: 'inherit',
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`wdio-bundler exited with code ${code}`));
        }
      });

      child.on('error', reject);
    });

    console.log('✅ JavaScript bundle created');
    console.log('🎉 Build complete!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

main();
