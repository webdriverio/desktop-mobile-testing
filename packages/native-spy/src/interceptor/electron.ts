import type { FrameworkAdapter, InnerMockMethod, InnerMockSetterMethod } from './framework.js';
import type { SerializedHandler } from './serialize.js';

/**
 * @internal Placeholder adapter — Electron support is not yet implemented.
 * All methods throw `'Not implemented'` at runtime. Do not use in production code.
 */
export class ElectronAdapter implements FrameworkAdapter {
  readonly framework = 'electron' as const;

  buildRegistrationScript(_mockName: string): string {
    throw new Error('Not implemented');
  }

  buildSetImplementationScript(_mockName: string, _s: SerializedHandler, _once?: boolean): string {
    throw new Error('Not implemented');
  }

  buildInnerInvocationScript(_mockName: string, _method: InnerMockMethod): string {
    throw new Error('Not implemented');
  }

  buildInnerSetterScript(_mockName: string, _method: InnerMockSetterMethod, _value: unknown): string {
    throw new Error('Not implemented');
  }

  buildCallDataReadScript(_mockName: string): string {
    throw new Error('Not implemented');
  }

  buildUnregistrationScript(_mockName: string): string {
    throw new Error('Not implemented');
  }

  buildWithImplementationScript(_mockName: string, _implFnSource: string, _callbackFnSource: string): string {
    throw new Error('Not implemented');
  }
}
