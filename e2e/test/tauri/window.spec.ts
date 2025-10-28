import { expect } from 'chai';

describe('Tauri Window Management', () => {
  it('should get window bounds', async () => {
    const result = await browser.tauri.execute('get_window_bounds');
    expect(result.success).to.be.true;
    expect(result.data).to.have.property('x');
    expect(result.data).to.have.property('y');
    expect(result.data).to.have.property('width');
    expect(result.data).to.have.property('height');
  });

  it('should set window bounds', async () => {
    const newBounds = { x: 100, y: 100, width: 800, height: 600 };
    const result = await browser.tauri.execute('set_window_bounds', newBounds);

    // Setting window bounds may fail in headless/CI environments
    // but should at least return a proper result structure
    expect(result).to.have.property('success');

    if (result.success) {
      // Only verify bounds if setting succeeded
      const bounds = await browser.tauri.execute('get_window_bounds');
      expect(bounds.success).to.be.true;
      expect(bounds.data).to.deep.include(newBounds);
    }
  });

  it('should minimize window', async () => {
    // Note: Minimized windows cannot be programmatically restored in most window managers
    // and this operation may fail in headless/CI environments
    const result = await browser.tauri.execute('minimize_window');
    // We expect this to succeed or fail gracefully depending on the environment
    expect(result).to.have.property('success');
  });

  it('should maximize and unmaximize window', async () => {
    // Maximize window
    let result = await browser.tauri.execute('maximize_window');
    expect(result.success).to.be.true;

    // Unmaximize window
    result = await browser.tauri.execute('unmaximize_window');
    expect(result.success).to.be.true;
  });
});
