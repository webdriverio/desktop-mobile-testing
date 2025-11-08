# Tauri Plugin Test Coverage Improvement Plan

**Date:** 2025-11-06
**Status:** Draft
**Priority:** High

## Executive Summary

This plan outlines the highest-value E2E tests needed to bring the Tauri plugin to production-ready test coverage. The current tests cover basic functionality well, but lack coverage for edge cases, error scenarios, and complex execute patterns that users will encounter in real-world usage.

## Current Test Coverage Assessment

### ✅ Well Covered
- Basic `execute()` with Tauri command invocation
- Simple JavaScript execution (arithmetic)
- Standard session mode
- Standalone session mode
- Multiremote mode (basic)
- Service initialization
- Plugin availability checks
- Path resolution error handling

### ⚠️ Gaps Identified

#### Critical Gaps (Block Production)
1. **Complex Execute Scenarios** - Users will write complex functions
2. **Error Propagation** - Tauri command errors need proper handling
3. **Parameter Passing** - Multiple args, destructuring, spread operators
4. **Async/Promise Handling** - Most Tauri commands return Promises

#### Important Gaps (Should Fix Before Launch)
5. **Plugin Unavailability** - Test the 5-second polling timeout
6. **Script Serialization Edge Cases** - Functions with inner functions, closures
7. **Large Return Values** - JSON serialization limits
8. **Timeout Scenarios** - 30-second timeout on plugin execute

#### Nice to Have (Post-Launch)
9. **Concurrent Execute Operations** - Multiple parallel calls
10. **Different Tauri API Modules** - Test fs, dialog, event, etc.

## Package Tests Analysis

**Current Status:** ✅ Adequate for unit testing

The package tests (`packages/tauri-service/test/index.spec.ts`) are minimal but sufficient:
- Export verification ✅
- Path resolution error handling ✅
- Built app detection ✅
- API surface documentation ✅

**Recommendation:** No additional package tests needed. The service is best tested through E2E tests since it's primarily a wrapper around WebDriver execute.

## Proposed E2E Tests - Priority Order

### Priority 1: Critical for Production (Must Have)

#### Test File: `e2e/test/tauri/execute-advanced.spec.ts`

**1. Execute with Multiple Parameters**
```typescript
it('should pass multiple parameters to execute function', async () => {
  const result = await browser.tauri.execute(
    (tauri, a, b, c) => a + b + c,
    10, 20, 30
  );
  expect(result).toBe(60);
});
```
**Value:** Users will pass arguments to their test functions. This is a fundamental use case.

**2. Execute with Destructured Parameters**
```typescript
it('should handle destructured parameters', async () => {
  const result = await browser.tauri.execute(
    (tauri, { name, value }) => `${name}: ${value}`,
    { name: 'test', value: 42 }
  );
  expect(result).toBe('test: 42');
});
```
**Value:** Destructuring is common in modern JavaScript. Tests the parameter serialization.

**3. Execute Async Function with Multiple Awaits**
```typescript
it('should execute async function with multiple Tauri commands', async () => {
  const result = await browser.tauri.execute(async ({ core }) => {
    const info1 = await core.invoke('get_platform_info');
    const info2 = await core.invoke('get_platform_info');
    return { os: info1.os, same: info1.os === info2.os };
  });
  expect(result.same).toBe(true);
});
```
**Value:** Real-world tests will chain multiple Tauri commands. This tests the async execution path.

**4. Execute Function with Inner Functions**
```typescript
it('should handle functions with inner function declarations', async () => {
  const result = await browser.tauri.execute((tauri) => {
    function helper(x) {
      return x * 2;
    }
    return helper(21);
  });
  expect(result).toBe(42);
});
```
**Value:** Tests the function stringification and scope handling. Common pattern in tests.

**5. Execute Function with Arrow Functions**
```typescript
it('should handle functions with inner arrow functions', async () => {
  const result = await browser.tauri.execute((tauri) => {
    const helper = (x) => x * 2;
    return helper(21);
  });
  expect(result).toBe(42);
});
```
**Value:** Arrow functions are the modern standard. Must work correctly.

**6. Execute Function That Throws Error**
```typescript
it('should propagate errors from execute function', async () => {
  await expect(
    browser.tauri.execute(() => {
      throw new Error('Test error from execute');
    })
  ).rejects.toThrow('Test error from execute');
});
```
**Value:** Critical for debugging. Users need to see their errors.

**7. Execute Function with Promise Rejection**
```typescript
it('should handle promise rejections in execute', async () => {
  await expect(
    browser.tauri.execute(async () => {
      return await Promise.reject(new Error('Async error'));
    })
  ).rejects.toThrow('Async error');
});
```
**Value:** Async errors are common. Must propagate correctly.

**8. Execute with Invalid Tauri Command**
```typescript
it('should provide clear error for invalid Tauri commands', async () => {
  await expect(
    browser.tauri.execute(({ core }) => core.invoke('nonexistent_command'))
  ).rejects.toThrow();
});
```
**Value:** User will make typos. Error message should be helpful.

#### Test File: `e2e/test/tauri/execute-data-types.spec.ts`

**9. Execute Returning Complex Object**
```typescript
it('should return complex nested objects', async () => {
  const result = await browser.tauri.execute(() => ({
    nested: {
      array: [1, 2, 3],
      object: { key: 'value' },
      null: null,
      undefined: undefined,
      boolean: true,
      number: 42,
      string: 'test'
    }
  }));
  expect(result.nested.array).toEqual([1, 2, 3]);
  expect(result.nested.object.key).toBe('value');
});
```
**Value:** Tests JSON serialization round-trip for complex data structures.

**10. Execute Returning Array**
```typescript
it('should return arrays correctly', async () => {
  const result = await browser.tauri.execute(({ core }) =>
    core.invoke('get_platform_info').then(info => [info.os, info.arch])
  );
  expect(Array.isArray(result)).toBe(true);
  expect(result).toHaveLength(2);
});
```
**Value:** Arrays are common return types. Must serialize correctly.

**11. Execute Returning Large Object**
```typescript
it('should handle large return values', async () => {
  const result = await browser.tauri.execute(() => {
    const large = [];
    for (let i = 0; i < 1000; i++) {
      large.push({ id: i, value: `item-${i}` });
    }
    return large;
  });
  expect(result).toHaveLength(1000);
  expect(result[999].id).toBe(999);
});
```
**Value:** Tests serialization limits. Users will fetch large data sets.

### Priority 2: Important for Launch Quality

#### Test File: `e2e/test/tauri/plugin-availability.spec.ts`

**12. Plugin Not Available Error**
```typescript
it('should timeout and error when plugin not available', async () => {
  // This requires a test app without the plugin registered
  // OR we could test the timeout by injecting a delay
  // Skip for now, but document as a manual test scenario
});
```
**Value:** Medium - Users will get this error if they forget to register plugin.
**Note:** Requires special test setup. Document as manual test for now.

**13. Window.__TAURI__ Not Available**
```typescript
it('should error clearly when window.__TAURI__ is not available', async () => {
  const result = await browser.execute(() => {
    // Temporarily hide __TAURI__
    const original = window.__TAURI__;
    delete window.__TAURI__;
    try {
      // @ts-expect-error - Testing plugin behavior
      return window.wdioTauri.execute('() => 1 + 1', []);
    } catch (error) {
      window.__TAURI__ = original;
      return { error: error.message };
    }
  });
  expect(result.error).toContain('window.__TAURI__');
});
```
**Value:** Tests error message clarity for common misconfiguration.

#### Test File: `e2e/test/tauri/multiremote-advanced.spec.ts`

**14. Multiremote with Different Commands**
```typescript
it('should execute different commands on different instances', async () => {
  const multi = multiremotebrowser as WebdriverIO.MultiRemoteBrowser;
  const browserA = multi.getInstance('browserA');
  const browserB = multi.getInstance('browserB');

  const [resultA, resultB] = await Promise.all([
    browserA.tauri.execute(({ core }) => core.invoke('get_platform_info')),
    browserB.tauri.execute(() => 1 + 1)
  ]);

  expect(resultA).toHaveProperty('os');
  expect(resultB).toBe(2);
});
```
**Value:** Tests that multiremote instances don't interfere with each other.

**15. Multiremote Sequential vs Parallel**
```typescript
it('should handle sequential execution in multiremote', async () => {
  const multi = multiremotebrowser as WebdriverIO.MultiRemoteBrowser;
  const browserA = multi.getInstance('browserA');
  const browserB = multi.getInstance('browserB');

  // Sequential
  const resultA = await browserA.tauri.execute(() => Date.now());
  await new Promise(resolve => setTimeout(resolve, 100));
  const resultB = await browserB.tauri.execute(() => Date.now());

  expect(resultB).toBeGreaterThan(resultA);
});
```
**Value:** Documents that instances can be used sequentially without issues.

### Priority 3: Nice to Have (Post-Launch)

#### Test File: `e2e/test/tauri/execute-performance.spec.ts`

**16. Rapid Sequential Execute Calls**
```typescript
it('should handle rapid sequential execute calls', async () => {
  const results = [];
  for (let i = 0; i < 10; i++) {
    results.push(await browser.tauri.execute((tauri, n) => n * 2, i));
  }
  expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
});
```
**Value:** Tests that the plugin can handle rapid calls without issues.

**17. Parallel Execute Calls**
```typescript
it('should handle parallel execute calls', async () => {
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(browser.tauri.execute((tauri, n) => n * 2, i));
  }
  const results = await Promise.all(promises);
  expect(results).toEqual([0, 2, 4, 6, 8]);
});
```
**Value:** Tests concurrent execution safety.

**18. Different Tauri API Modules**
```typescript
it('should access different Tauri API modules', async () => {
  const result = await browser.tauri.execute(({ core, event }) => {
    return {
      hasCore: typeof core !== 'undefined',
      hasEvent: typeof event !== 'undefined',
      hasInvoke: typeof core.invoke === 'function',
    };
  });
  expect(result.hasCore).toBe(true);
  expect(result.hasInvoke).toBe(true);
});
```
**Value:** Documents that different Tauri APIs are accessible.

## Test Implementation Strategy

### Phase 1: Critical Tests (Priority 1)
**Timeline:** 1-2 days
**Tests:** 1-11
**Goal:** Production-ready core functionality

Create two new test files:
- `e2e/test/tauri/execute-advanced.spec.ts` (Tests 1-8)
- `e2e/test/tauri/execute-data-types.spec.ts` (Tests 9-11)

### Phase 2: Launch Quality (Priority 2)
**Timeline:** 1 day
**Tests:** 12-15
**Goal:** Handle edge cases and multiremote scenarios

Create two new test files:
- `e2e/test/tauri/plugin-availability.spec.ts` (Tests 12-13)
- `e2e/test/tauri/multiremote-advanced.spec.ts` (Tests 14-15)

### Phase 3: Enhancement (Priority 3)
**Timeline:** Post-launch
**Tests:** 16-18
**Goal:** Performance validation and documentation

Create one new test file:
- `e2e/test/tauri/execute-performance.spec.ts` (Tests 16-18)

## Test File Organization

```
e2e/test/tauri/
├── api.spec.ts                          # ✅ Existing - Basic API tests
├── standalone/
│   └── api.spec.ts                      # ✅ Existing - Standalone mode
├── multiremote/
│   ├── api.spec.ts                      # ✅ Existing - Basic multiremote
│   └── advanced.spec.ts                 # 🆕 Priority 2 - Advanced multiremote
├── execute-advanced.spec.ts             # 🆕 Priority 1 - Complex execute patterns
├── execute-data-types.spec.ts           # 🆕 Priority 1 - Data serialization
├── plugin-availability.spec.ts          # 🆕 Priority 2 - Error scenarios
└── execute-performance.spec.ts          # 🆕 Priority 3 - Performance tests
```

## Success Criteria

### For Production Launch
- ✅ All Priority 1 tests (1-11) passing
- ✅ All Priority 2 tests (12-15) passing OR documented as known limitations
- ✅ Test coverage > 80% for execute.ts command
- ✅ All tests passing on CI for macOS, Linux, Windows

### For Post-Launch
- ✅ All Priority 3 tests (16-18) passing
- ✅ Test coverage > 90% for tauri-service package
- ✅ Performance benchmarks documented

## Risk Assessment

### Low Risk (Already Covered)
- Basic execute functionality ✅
- Session initialization ✅
- Service API surface ✅

### Medium Risk (Priority 1 addresses)
- Complex function serialization ⚠️
- Error propagation ⚠️
- Data type handling ⚠️

### Low Risk (Priority 2 addresses)
- Plugin unavailability scenarios ⚠️
- Multiremote edge cases ⚠️

## Comparison with Electron Service

The Electron service has extensive test coverage including:
- Mock functionality (150+ lines of tests)
- All mock methods (mockImplementation, mockReturnValue, etc.)
- Mock state management (clearAllMocks, resetAllMocks, restoreAllMocks)
- Complex execute patterns ✅

For Tauri plugin launch:
- Mock functionality is intentionally excluded (separate implementation)
- Execute patterns should match Electron's coverage
- Priority 1 tests bring execute coverage to parity with Electron

## Conclusion

**Current Status:** Basic functionality well-tested, production readiness requires Priority 1 tests.

**Recommendation:** Implement Priority 1 tests (11 tests, ~200 lines) before considering the plugin production-ready. Priority 2 tests improve quality but aren't blockers. Priority 3 tests are for optimization and documentation.

**Estimated Effort:**
- Priority 1: 4-6 hours (critical path)
- Priority 2: 2-3 hours (quality improvement)
- Priority 3: 2-3 hours (nice to have)
- **Total:** 8-12 hours for full coverage

**Package Tests:** No changes needed. Current coverage is appropriate for the service architecture.
