export type IpcContext = { [key: string]: unknown };

export function buildContextSeedScript(context: IpcContext): string {
  const serialized = JSON.stringify(JSON.stringify(context));
  return `(_tauri) => { if (!window.__wdio_ipc_context__) { window.__wdio_ipc_context__ = {}; } Object.assign(window.__wdio_ipc_context__, JSON.parse(${serialized})); }`;
}
