import type { TauriMock } from '@wdio/native-types';

export class TauriServiceMockStore {
  #mockFns: Map<string, TauriMock>;

  constructor() {
    this.#mockFns = new Map<string, TauriMock>();
  }

  setMock(mock: TauriMock): TauriMock {
    this.#mockFns.set(mock.getMockName(), mock);
    return mock;
  }

  getMock(mockId: string) {
    const mock = this.#mockFns.get(mockId);
    if (!mock) {
      throw new Error(`No mock registered for "${mockId}"`);
    }

    return mock;
  }

  getMocks() {
    return Array.from(this.#mockFns.entries());
  }

  /**
   * Remove a specific mock from the store
   */
  deleteMock(mockId: string): boolean {
    return this.#mockFns.delete(mockId);
  }

  /**
   * Clear all mocks from the store
   * Called during session cleanup to prevent memory leaks
   */
  clear(): void {
    this.#mockFns.clear();
  }
}

const mockStore = new TauriServiceMockStore();

export default mockStore;
