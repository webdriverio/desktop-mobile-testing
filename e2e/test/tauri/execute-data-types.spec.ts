import { browser, expect } from '@wdio/globals';
import '@wdio/native-types';

describe('Tauri Execute - Data Types', () => {
  it('should return complex nested objects', async () => {
    const result = await browser.tauri.execute(() => ({
      nested: {
        array: [1, 2, 3],
        object: { key: 'value' },
        null: null,
        undefined: undefined,
        boolean: true,
        number: 42,
        string: 'test',
      },
    }));
    expect(result?.nested.array).toEqual([1, 2, 3]);
    expect(result?.nested.object.key).toBe('value');
    expect(result?.nested.null).toBeNull();
    expect(result?.nested.undefined).toBeUndefined();
    expect(result?.nested.boolean).toBe(true);
    expect(result?.nested.number).toBe(42);
    expect(result?.nested.string).toBe('test');
  });

  it('should return arrays correctly', async () => {
    const result = await browser.tauri.execute(({ core }) =>
      core.invoke('get_platform_info').then((info) => {
        const { os, arch } = info as { os: string; arch: string };
        return [os, arch];
      }),
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(typeof result?.[0]).toBe('string'); // os
    expect(typeof result?.[1]).toBe('string'); // arch
  });

  it('should handle large return values', async () => {
    const result = await browser.tauri.execute(() => {
      const large = [];
      for (let i = 0; i < 1000; i++) {
        large.push({ id: i, value: `item-${i}` });
      }
      return large;
    });
    expect(result).toHaveLength(1000);
    expect(result?.[0]?.id).toBe(0);
    expect(result?.[999]?.id).toBe(999);
    expect(result?.[999]?.value).toBe('item-999');
  });
});
