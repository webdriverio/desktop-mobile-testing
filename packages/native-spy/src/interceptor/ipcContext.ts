export type IpcContext = { [key: string]: unknown };

const unsafeJsCharMap: Record<string, string> = {
  '<': '\\u003C',
  '>': '\\u003E',
  '/': '\\u002F',
};

function escapeUnsafeJsChars(str: string): string {
  return str
    .replace(/[<>/]/g, (ch) => unsafeJsCharMap[ch])
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildContextSeedScript(context: IpcContext): string {
  const serialized = escapeUnsafeJsChars(JSON.stringify(JSON.stringify(context)));
  return `(_tauri) => { if (!window.__wdio_ipc_context__) { window.__wdio_ipc_context__ = {}; } Object.assign(window.__wdio_ipc_context__, JSON.parse(${serialized})); }`;
}
