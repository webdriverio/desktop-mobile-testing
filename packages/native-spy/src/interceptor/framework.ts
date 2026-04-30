import type { SerializedHandler } from './serialize.js';

export type Framework = 'tauri' | 'electron';
export type InnerMockMethod = 'mockClear' | 'mockReset' | 'mockReturnThis';
export type InnerMockSetterMethod =
  | 'mockReturnValue'
  | 'mockReturnValueOnce'
  | 'mockResolvedValue'
  | 'mockResolvedValueOnce'
  | 'mockRejectedValue'
  | 'mockRejectedValueOnce';

export interface FrameworkAdapter {
  readonly framework: Framework;
  buildRegistrationScript(mockName: string): string;
  buildSetImplementationScript(mockName: string, s: SerializedHandler, once?: boolean): string;
  buildInnerInvocationScript(mockName: string, method: InnerMockMethod): string;
  buildInnerSetterScript(mockName: string, method: InnerMockSetterMethod, value: unknown): string;
  buildCallDataReadScript(mockName: string): string;
  buildUnregistrationScript(mockName: string): string;
  buildWithImplementationScript(mockName: string, implFnSource: string, callbackFnSource: string): string;
}
