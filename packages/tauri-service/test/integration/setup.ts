import { execSync } from 'node:child_process';

export default function setup() {
  try {
    execSync('pkill -9 -f "mock-success|mock-bind-fail|mock-tauri-driver" 2>/dev/null || true', {
      stdio: 'ignore',
    });
  } catch {
    // Ignore errors
  }
}
