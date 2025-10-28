import { expect } from 'chai';

describe('Tauri Multiremote', () => {
  it('should initialize Tauri API on multiple instances', async () => {
    // Test that both browser instances have Tauri API
    expect(browserA.tauri).to.exist;
    expect(browserB.tauri).to.exist;
    expect(browserA.tauri.execute).to.be.a('function');
    expect(browserB.tauri.execute).to.be.a('function');
  });

  it('should execute commands independently on multiple instances', async () => {
    // Test that execute() works on both instances
    const resultA = await browserA.tauri.execute('get_platform_info');
    const resultB = await browserB.tauri.execute('get_platform_info');

    expect(resultA.success).to.be.true;
    expect(resultB.success).to.be.true;
    expect(resultA.data).to.deep.equal(resultB.data);
  });
});
