export type IpcContext = { [key: string]: unknown };

export function buildContextSeedScript(context: IpcContext): string {
  return `(_tauri) => { if (!window.__wdio_ipc_context__) { window.__wdio_ipc_context__ = {}; } Object.assign(window.__wdio_ipc_context__, ${JSON.stringify(context)}); }`;
}
