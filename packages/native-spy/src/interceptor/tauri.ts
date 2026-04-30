import type { FrameworkAdapter, InnerMockMethod, InnerMockSetterMethod } from './framework.js';
import { errorReconstructExpr, mockLookupExpr } from './injection.js';
import type { SerializedHandler } from './serialize.js';
import { safeJson } from './serialize.js';

export class TauriAdapter implements FrameworkAdapter {
  readonly framework = 'tauri' as const;

  buildRegistrationScript(mockName: string): string {
    return `(_tauri) => {
  const spy = window.__wdio_spy__;
  if (!spy?.fn) { throw new Error('@wdio/native-spy not available. Make sure @wdio/tauri-plugin is imported and initialized in your app.'); }
  const mockFn = spy.fn();
  mockFn.mockName('tauri.${mockName}');
  if (!window.__wdio_mocks__) { window.__wdio_mocks__ = {}; }
  window.__wdio_mocks__[${JSON.stringify(mockName)}] = mockFn;
  mockFn.mockClear();
}`;
  }

  buildCallDataReadScript(mockName: string): string {
    const lookup = mockLookupExpr(mockName);
    return `(_tauri) => {
  const mockObj = ${lookup};
  if (!mockObj?.mock) { return { calls: [], results: [], invocationCallOrder: [] }; }
  const m = mockObj.mock;
  return {
    calls: JSON.parse(JSON.stringify(m.calls || [])),
    results: JSON.parse(JSON.stringify(m.results || [])),
    invocationCallOrder: JSON.parse(JSON.stringify(m.invocationCallOrder || [])),
  };
}`;
  }

  buildSetImplementationScript(mockName: string, s: SerializedHandler, once = false): string {
    const lookup = mockLookupExpr(mockName);
    const method = once ? 'mockImplementationOnce' : 'mockImplementation';
    return `(_tauri) => {
  const mockObj = ${lookup};
  if (mockObj) { mockObj.${method}?.((${s.source})); }
}`;
  }

  buildInnerInvocationScript(mockName: string, method: InnerMockMethod): string {
    const lookup = mockLookupExpr(mockName);
    return `(_tauri) => {
  const mockObj = ${lookup};
  mockObj?.${method}?.();
}`;
  }

  buildInnerSetterScript(mockName: string, method: InnerMockSetterMethod, value: unknown): string {
    const lookup = mockLookupExpr(mockName);
    const serialized = safeJson(value);
    const reconstruct = errorReconstructExpr('_v');
    return `(_tauri) => {
  const _v = ${serialized};
  const mockObj = ${lookup};
  mockObj?.${method}?.(${reconstruct});
}`;
  }

  buildUnregistrationScript(mockName: string): string {
    return `(_tauri) => {
  if (window.__wdio_mocks__?.[${JSON.stringify(mockName)}]) {
    delete window.__wdio_mocks__[${JSON.stringify(mockName)}];
  }
}`;
  }

  buildWithImplementationScript(mockName: string, implFnSource: string, callbackFnSource: string): string {
    const lookup = mockLookupExpr(mockName);
    return `async (_tauri) => {
  const impl = (${implFnSource});
  const callback = (${callbackFnSource});
  let result;
  const mockObj = ${lookup};
  mockObj?.withImplementation?.(impl, () => { result = callback(_tauri); });
  return result?.then ? await result : result;
}`;
  }
}
