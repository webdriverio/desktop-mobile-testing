/// <reference types="../../@types/vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockAll } from '../../src/commands/mockAll.js';

describe('mockAll Command', () => {
  beforeEach(async () => {
    globalThis.browser = {
      electron: {
        execute: vi
          .fn()
          .mockReturnValue(
            'showOpenDialogSync,showOpenDialog,showSaveDialogSync,showSaveDialog,showMessageBoxSync,showMessageBox,showErrorBox,showCertificateTrustDialog',
          ),
      },
    } as unknown as WebdriverIO.Browser;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return mock functions for all API methods', async () => {
    const mockedDialog = await mockAll('dialog');
    expect(mockedDialog).toStrictEqual({
      showOpenDialogSync: expect.any(Function),
      showOpenDialog: expect.any(Function),
      showSaveDialogSync: expect.any(Function),
      showSaveDialog: expect.any(Function),
      showMessageBoxSync: expect.any(Function),
      showMessageBox: expect.any(Function),
      showErrorBox: expect.any(Function),
      showCertificateTrustDialog: expect.any(Function),
    });
    // Verify they have mock properties
    expect(mockedDialog.showOpenDialog).toHaveProperty('mock');
    expect(mockedDialog.showOpenDialog).toHaveProperty('mockImplementation');
  });
});
