jest.mock('axios', () => ({
  create: jest.fn(),
}));

import axios from 'axios';
import { ApiClient } from '../api-client';

describe('ApiClient', () => {
  let mockHttp: { post: jest.Mock; patch: jest.Mock };

  beforeEach(() => {
    mockHttp = { post: jest.fn(), patch: jest.fn() };
    (axios.create as jest.Mock).mockReturnValue(mockHttp);
  });

  it('registerWorker extracts the worker id from the wrapped { success, data } envelope', async () => {
    mockHttp.post.mockResolvedValue({ data: { success: true, data: { id: 'worker-xyz', name: 'w1' } } });

    const client = new ApiClient();
    const workerId = await client.registerWorker();

    expect(workerId).toBe('worker-xyz');
  });

  it('registerWorker throws a clear error when the response has no id', async () => {
    mockHttp.post.mockResolvedValue({ data: { success: true, data: {} } });

    const client = new ApiClient();
    await expect(client.registerWorker()).rejects.toThrow(/did not include an id/i);
  });

  it('updateTaskStatus does not throw even if the underlying HTTP call rejects', async () => {
    mockHttp.patch.mockRejectedValue(new Error('network down'));

    const client = new ApiClient();
    await expect(client.updateTaskStatus('task-1', 'FAILED' as any, {})).resolves.toBeUndefined();
  });

  it('appendLog does not throw even if the underlying HTTP call rejects', async () => {
    mockHttp.post.mockRejectedValue(new Error('network down'));

    const client = new ApiClient();
    await expect(client.appendLog('task-1', 'INFO' as any, 'msg')).resolves.toBeUndefined();
  });
});
