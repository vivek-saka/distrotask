import { executorRegistry } from '../executor-registry';

describe('ExecutorRegistry', () => {
  it('registers and resolves an executor by type', () => {
    const type = 'registry-test.basic.' + Date.now();
    const fn = jest.fn();

    executorRegistry.register(type, fn);

    expect(executorRegistry.resolve(type)).toBe(fn);
  });

  it('returns undefined for an unregistered type', () => {
    expect(executorRegistry.resolve('registry-test.never-registered.' + Date.now())).toBeUndefined();
  });

  it('throws when registering the same type twice', () => {
    const type = 'registry-test.duplicate.' + Date.now();
    executorRegistry.register(type, jest.fn());

    expect(() => executorRegistry.register(type, jest.fn())).toThrow(/already registered/i);
  });

  it('registeredTypes() includes a freshly registered type', () => {
    const type = 'registry-test.listed.' + Date.now();
    executorRegistry.register(type, jest.fn());

    expect(executorRegistry.registeredTypes()).toContain(type);
  });
});
