#!/usr/bin/env node
/**
 * Mock driver that simulates port bind failure
 * Used to test error detection in launcher
 */

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex !== -1 ? args[portIndex + 1] : '4444';

// Simulate bind failure (matching real tauri-driver error format)
console.error(`Error: can not listen on 127.0.0.1:${port}`);
console.error('Address already in use (os error 48)');

// Exit with error code
process.exit(1);
