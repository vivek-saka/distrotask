module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.spec.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
  testEnvironment: 'node',
  testTimeout: 15000,
  setupFiles: ['<rootDir>/test.setup.ts'],
};
