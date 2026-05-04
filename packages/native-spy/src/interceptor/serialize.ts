export interface SerializedHandler {
  source: string;
  label?: string;
}

export function serializeHandler(fn: (...args: unknown[]) => unknown): SerializedHandler {
  return { source: fn.toString() };
}

export function safeJson(value: unknown): string {
  if (value instanceof Error) {
    return JSON.stringify({ __wdioError: true, message: value.message });
  }
  try {
    return JSON.stringify(value) ?? 'undefined';
  } catch {
    return '"[unserializable]"';
  }
}
