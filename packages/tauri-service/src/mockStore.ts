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
}

const mockStore = new TauriServiceMockStore();

export default mockStore;
