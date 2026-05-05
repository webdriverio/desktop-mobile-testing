import { writeFileSync } from 'node:fs';

const stub = "export * from './interceptor/index.js';\n";
writeFileSync('dist/esm/interceptor.d.ts', stub);
writeFileSync('dist/cjs/interceptor.d.ts', stub);
