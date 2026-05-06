export interface MockCallData {
  calls: unknown[][];
  results: Array<{ type: 'return' | 'throw'; value: unknown }>;
  invocationCallOrder: number[];
}

export function parseCallData(raw: unknown): MockCallData {
  if (!raw || typeof raw !== 'object') return { calls: [], results: [], invocationCallOrder: [] };
  const r = raw as Record<string, unknown>;
  return {
    calls: Array.isArray(r.calls) ? (r.calls as unknown[][]) : [],
    results: Array.isArray(r.results) ? (r.results as MockCallData['results']) : [],
    invocationCallOrder: Array.isArray(r.invocationCallOrder) ? (r.invocationCallOrder as number[]) : [],
  };
}
