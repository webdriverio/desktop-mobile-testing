import { createWorker } from 'tesseract.js';

export type StructuralResult = { width: number; height: number; byteLength: number };

export function assertValidPng(png: Buffer): StructuralResult {
  if (
    png.length < 24 ||
    png[0] !== 0x89 ||
    png[1] !== 0x50 ||
    png[2] !== 0x4e ||
    png[3] !== 0x47 ||
    png[4] !== 0x0d ||
    png[5] !== 0x0a ||
    png[6] !== 0x1a ||
    png[7] !== 0x0a
  ) {
    throw new Error('buffer is not a valid PNG (bad magic bytes)');
  }
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    byteLength: png.length,
  };
}

export function assertCapturesChrome(native: StructuralResult, webview: StructuralResult): void {
  if (native.height <= webview.height) {
    throw new Error(
      `expected native screenshot height (${native.height}px) > webview height (${webview.height}px); ` +
        'the title bar chrome may not have been captured',
    );
  }
}

let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | undefined;

export async function ocrText(png: Buffer): Promise<string> {
  workerPromise ??= createWorker('eng', undefined, { logger: () => {} });
  const worker = await workerPromise;
  const { data } = await worker.recognize(png);
  return data.text;
}

export async function assertOcrContains(png: Buffer, expected: string[]): Promise<void> {
  const text = (await ocrText(png)).toLowerCase();
  const missing = expected.filter((s) => !text.includes(s.toLowerCase()));
  if (missing.length) {
    throw new Error(
      `OCR assertion failed — missing text: ${missing.join(', ')}\n--- OCR output ---\n${text.slice(0, 500)}`,
    );
  }
}

export async function disposeOcr(): Promise<void> {
  const w = workerPromise ? await workerPromise : undefined;
  workerPromise = undefined;
  await w?.terminate();
}
