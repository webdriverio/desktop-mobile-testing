import { expect } from 'chai';

describe('Tauri Multiremote', () => {
  it('should handle multiple Tauri instances', async () => {
    // Test that both browser instances have Tauri API
    expect(browserA.tauri).to.exist;
    expect(browserB.tauri).to.exist;

    // Test basic operations on both instances
    const resultA = await browserA.tauri.execute('get_platform_info');
    const resultB = await browserB.tauri.execute('get_platform_info');

    expect(resultA.success).to.be.true;
    expect(resultB.success).to.be.true;
    expect(resultA.data).to.deep.equal(resultB.data);
  });

  it('should handle independent window operations', async () => {
    // Set different bounds for each window
    const boundsA = { x: 100, y: 100, width: 400, height: 300 };
    const boundsB = { x: 500, y: 100, width: 400, height: 300 };

    const resultA = await browserA.tauri.execute('set_window_bounds', boundsA);
    const resultB = await browserB.tauri.execute('set_window_bounds', boundsB);

    expect(resultA.success).to.be.true;
    expect(resultB.success).to.be.true;

    // Verify the bounds were set independently
    const boundsResultA = await browserA.tauri.execute('get_window_bounds');
    const boundsResultB = await browserB.tauri.execute('get_window_bounds');

    expect(boundsResultA.data).to.deep.include(boundsA);
    expect(boundsResultB.data).to.deep.include(boundsB);
  });

  it('should handle independent clipboard operations', async () => {
    // Set different clipboard content for each instance
    const contentA = 'Content for browser A';
    const contentB = 'Content for browser B';

    const resultA = await browserA.tauri.execute('write_clipboard', contentA);
    const resultB = await browserB.tauri.execute('write_clipboard', contentB);

    expect(resultA.success).to.be.true;
    expect(resultB.success).to.be.true;

    // Verify each instance has its own clipboard content
    const readResultA = await browserA.tauri.execute('read_clipboard');
    const readResultB = await browserB.tauri.execute('read_clipboard');

    expect(readResultA.data).to.equal(contentA);
    expect(readResultB.data).to.equal(contentB);
  });
});
