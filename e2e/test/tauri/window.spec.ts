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
    expect(result.success).to.be.true;

    // Verify the bounds were set
    const bounds = await browser.tauri.execute('get_window_bounds');
    expect(bounds.success).to.be.true;
    expect(bounds.data).to.deep.include(newBounds);
  });

  it('should minimize and unminimize window', async () => {
    // Minimize window
    let result = await browser.tauri.execute('minimize_window');
    expect(result.success).to.be.true;

    // Unminimize window
    result = await browser.tauri.execute('unminimize_window');
    expect(result.success).to.be.true;
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
