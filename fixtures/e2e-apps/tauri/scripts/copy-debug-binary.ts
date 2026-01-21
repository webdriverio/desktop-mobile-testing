#!/usr/bin/env tsx
/**
 * Copy debug binary to release directory
 * This ensures CI binary verification works regardless of build type
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname: string = dirname(fileURLToPath(import.meta.url));
const targetDir: string = join(__dirname, '..', 'src-tauri', 'target');
const debugDir: string = join(targetDir, 'debug');
const releaseDir: string = join(targetDir, 'release');

if (!existsSync(debugDir)) {
  console.error('❌ Debug directory not found:', debugDir);
  process.exit(1);
}

// Create release directory if it doesn't exist
mkdirSync(releaseDir, { recursive: true });

// Find and copy executables from debug to release
const debugFiles: string[] = readdirSync(debugDir);
let copiedCount = 0;

for (const file of debugFiles) {
  const debugPath: string = join(debugDir, file);
  const releasePath: string = join(releaseDir, file);

  // Skip directories
  if (!statSync(debugPath).isFile()) {
    continue;
  }

  // Copy executable files (.exe on Windows, or executable permission on Unix)
  if (file.endsWith('.exe') || statSync(debugPath).mode & 0o111) {
    try {
      copyFileSync(debugPath, releasePath);
      copiedCount++;
      console.log(`✅ Copied ${file} from debug/ to release/`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to copy ${file}:`, errorMessage);
    }
  }
}

if (copiedCount === 0) {
  console.error('❌ No executables found in debug directory');
  process.exit(1);
}

console.log(`✅ Successfully copied ${copiedCount} binary/binaries to release directory`);
