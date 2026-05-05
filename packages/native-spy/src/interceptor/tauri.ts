import type { FrameworkAdapter, InnerMockMethod, InnerMockSetterMethod } from './framework.js';
import { errorReconstructExpr, mockLookupExpr } from './injection.js';
import type { IpcContext } from './ipcContext.js';
import { buildContextSeedScript } from './ipcContext.js';
import type { SerializedHandler } from './serialize.js';
import { safeJson } from './serialize.js';

export class TauriAdapter implements FrameworkAdapter {
  readonly framework = 'tauri' as const;

  buildRegistrationScript(mockName: string): string {
    return `(_tauri) => {
  const spy = window.__wdio_spy__;
  if (!spy?.fn) { throw new Error('@wdio/native-spy not available. Make sure @wdio/tauri-plugin is imported and initialized in your app.'); }
  const mockFn = spy.fn();
  mockFn.mockName(${JSON.stringify(`tauri.${mockName}`)});
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

  buildContextSeedScript(context: IpcContext): string {
    return buildContextSeedScript(context);
  }

  buildBrowserIpcInjectionScript(): string {
    return `(function() {
  window.__wdio_call_id__ = window.__wdio_call_id__ || 0;
  function createMockFn() {
    var _name = 'spy';
    var _defaultImpl;
    var _implQueue = [];
    var _defaultReturnValue;
    var _defaultResolvedValue;
    var _defaultRejectedValue;
    var _returnThis = false;
    var _calls = [];
    var _results = [];
    var _invocationCallOrder = [];
    function mockFn() {
      var args = Array.prototype.slice.call(arguments);
      _calls.push(args);
      _invocationCallOrder.push(window.__wdio_call_id__++);
      var impl = _implQueue.length > 0 ? _implQueue.shift() : _defaultImpl;
      if (impl !== undefined) {
        try {
          var val = impl.apply(this, args);
          _results.push({ type: 'return', value: val });
          return val;
        } catch (e) {
          _results.push({ type: 'throw', value: e });
          throw e;
        }
      } else if (_defaultRejectedValue !== undefined) {
        var rv = _defaultRejectedValue;
        _results.push({ type: 'throw', value: rv });
        throw rv;
      } else if (_defaultResolvedValue !== undefined) {
        var p = Promise.resolve(_defaultResolvedValue);
        _results.push({ type: 'return', value: p });
        return p;
      } else if (_returnThis) {
        _results.push({ type: 'return', value: this });
        return this;
      } else if (_defaultReturnValue !== undefined) {
        _results.push({ type: 'return', value: _defaultReturnValue });
        return _defaultReturnValue;
      } else {
        _results.push({ type: 'return', value: undefined });
        return undefined;
      }
    }
    mockFn._isMockFunction = true;
    Object.defineProperty(mockFn, 'mock', {
      get: function() { return { calls: _calls, results: _results, invocationCallOrder: _invocationCallOrder }; },
      enumerable: true, configurable: true
    });
    mockFn.mockName = function(n) { _name = n; return mockFn; };
    mockFn.getMockName = function() { return _name; };
    mockFn.getMockImplementation = function() { return _defaultImpl; };
    mockFn.mockImplementation = function(fn) { _defaultImpl = fn; _returnThis = false; return mockFn; };
    mockFn.mockImplementationOnce = function(fn) { _implQueue.push(fn); return mockFn; };
    mockFn.mockReturnValue = function(val) {
      _defaultImpl = undefined; _defaultReturnValue = val; _defaultResolvedValue = undefined;
      _defaultRejectedValue = undefined; _returnThis = false; return mockFn;
    };
    mockFn.mockReturnValueOnce = function(val) { _implQueue.push(function() { return val; }); return mockFn; };
    mockFn.mockResolvedValue = function(val) {
      _defaultImpl = undefined; _defaultResolvedValue = val; _defaultReturnValue = undefined;
      _defaultRejectedValue = undefined; _returnThis = false; return mockFn;
    };
    mockFn.mockResolvedValueOnce = function(val) {
      _implQueue.push(function() { return Promise.resolve(val); }); return mockFn;
    };
    mockFn.mockRejectedValue = function(val) {
      _defaultImpl = undefined; _defaultRejectedValue = val; _defaultReturnValue = undefined;
      _defaultResolvedValue = undefined; _returnThis = false; return mockFn;
    };
    mockFn.mockRejectedValueOnce = function(val) {
      _implQueue.push(function() { throw val; }); return mockFn;
    };
    mockFn.mockClear = function() {
      _calls = []; _results = []; _invocationCallOrder = []; _implQueue = [];
      return mockFn;
    };
    mockFn.mockReset = function() {
      mockFn.mockClear();
      _defaultImpl = undefined; _defaultReturnValue = undefined;
      _defaultResolvedValue = undefined; _defaultRejectedValue = undefined; _returnThis = false;
      return mockFn;
    };
    mockFn.mockReturnThis = function() {
      _returnThis = true; _defaultReturnValue = undefined; _defaultResolvedValue = undefined;
      _defaultRejectedValue = undefined; return mockFn;
    };
    mockFn.withImplementation = function(fn, callback) {
      var prevImpl = _defaultImpl, prevQueue = _implQueue.slice(), prevReturnThis = _returnThis;
      _defaultImpl = fn; _implQueue = []; _returnThis = false;
      var result = callback();
      if (result && typeof result.then === 'function') {
        return result.then(function(r) {
          _defaultImpl = prevImpl; _implQueue = prevQueue; _returnThis = prevReturnThis; return r;
        }, function(e) {
          _defaultImpl = prevImpl; _implQueue = prevQueue; _returnThis = prevReturnThis; throw e;
        });
      }
      _defaultImpl = prevImpl; _implQueue = prevQueue; _returnThis = prevReturnThis;
      return result;
    };
    return mockFn;
  }
  window.__wdio_spy__ = { fn: createMockFn };
  if (!window.__wdio_mocks__) { window.__wdio_mocks__ = {}; }
  if (!window.__TAURI_INTERNALS__) { window.__TAURI_INTERNALS__ = {}; }
  window.__TAURI_INTERNALS__.invoke = function(cmd, args) {
    var mock = window.__wdio_mocks__ && window.__wdio_mocks__[cmd];
    if (mock && typeof mock === 'function') {
      return Promise.resolve().then(function() { return mock(args); });
    }
    return Promise.reject(new Error('unmocked Tauri command in browser mode: ' + cmd));
  };
})()`;
  }

  buildWithImplementationScript(mockName: string, implFnSource: string, callbackFnSource: string): string {
    const lookup = mockLookupExpr(mockName);
    return `async (_tauri) => {
  const impl = (${implFnSource});
  const callback = (${callbackFnSource});
  let result;
  const mockObj = ${lookup};
  await mockObj?.withImplementation?.(impl, async () => { result = await callback(_tauri); });
  return result;
}`;
  }
}
