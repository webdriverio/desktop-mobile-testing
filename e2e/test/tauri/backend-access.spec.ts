import { expect } from 'chai';

describe('Tauri Backend Access', () => {
  it('should execute Rust backend commands', async () => {
    // Test basic backend command execution
    const result = await browser.tauri.execute('get_system_info');
    expect(result.success).to.be.true;
    expect(result.data).to.have.property('cpu_count');
    expect(result.data).to.have.property('memory_total');
    expect(result.data).to.have.property('uptime');
  });

  it('should handle backend command with parameters', async () => {
    // Test backend command with parameters
    const result = await browser.tauri.execute('calculate', { operation: 'add', a: 5, b: 3 });
    expect(result.success).to.be.true;
    expect(result.data).to.equal(8);
  });

  it('should execute complex backend operations', async () => {
    // Test more complex backend operations
    const result = await browser.tauri.execute('process_data', {
      data: [1, 2, 3, 4, 5],
      operation: 'sum',
    });
    expect(result.success).to.be.true;
    expect(result.data).to.equal(15);
  });

  it('should handle backend errors gracefully', async () => {
    // Test error handling for backend operations
    const result = await browser.tauri.execute('divide', { a: 10, b: 0 });
    expect(result.success).to.be.false;
    expect(result.error).to.include('division by zero');
  });

  it('should execute async backend operations', async () => {
    // Test async backend operations
    const result = await browser.tauri.execute('async_operation', { delay: 100 });
    expect(result.success).to.be.true;
    expect(result.data).to.have.property('completed_at');
  });

  it('should handle backend state management', async () => {
    // Test backend state operations
    let result = await browser.tauri.execute('set_state', { key: 'test_key', value: 'test_value' });
    expect(result.success).to.be.true;

    result = await browser.tauri.execute('get_state', { key: 'test_key' });
    expect(result.success).to.be.true;
    expect(result.data).to.equal('test_value');
  });
});
