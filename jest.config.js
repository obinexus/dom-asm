module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/test/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/index.ts',
    '!src/types.ts',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    // Legacy support (to be deprecated)
    '^@/(.*)$': '<rootDir>/src/$1',
    
    // Domain-specific path mappings for strict separation of concerns
    '^@dom-asm/core$': '<rootDir>/src/core/index.ts',
    '^@dom-asm/core/(.*)$': '<rootDir>/src/core/$1',
    '^@dom-asm/html$': '<rootDir>/src/html/index.ts',
    '^@dom-asm/html/(.*)$': '<rootDir>/src/html/$1',
    '^@dom-asm/css$': '<rootDir>/src/css/index.ts',
    '^@dom-asm/css/(.*)$': '<rootDir>/src/css/$1',
    '^@dom-asm/js$': '<rootDir>/src/js/index.ts',
    '^@dom-asm/js/(.*)$': '<rootDir>/src/js/$1',
    '^@dom-asm/state-machine$': '<rootDir>/src/state-machine/index.ts',
    '^@dom-asm/state-machine/(.*)$': '<rootDir>/src/state-machine/$1',
    '^@dom-asm/advanced$': '<rootDir>/src/advanced/index.ts',
    '^@dom-asm/advanced/(.*)$': '<rootDir>/src/advanced/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  // Domain-specific test pattern matching
  projects: [
    {
      displayName: 'HTML Pipeline Tests',
      testMatch: ['<rootDir>/test/unit/html/**/*.test.ts'],
      moduleNameMapper: {
        '^@dom-asm/html/(.*)$': '<rootDir>/src/html/$1',
        '^@dom-asm/core/(.*)$': '<rootDir>/src/core/$1',
        '^@dom-asm/state-machine/(.*)$': '<rootDir>/src/state-machine/$1'
      }
    },
    {
      displayName: 'CSS Pipeline Tests',
      testMatch: ['<rootDir>/test/unit/css/**/*.test.ts'],
      moduleNameMapper: {
        '^@dom-asm/css/(.*)$': '<rootDir>/src/css/$1',
        '^@dom-asm/core/(.*)$': '<rootDir>/src/core/$1',
        '^@dom-asm/state-machine/(.*)$': '<rootDir>/src/state-machine/$1'
      }
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/test/integration/**/*.test.ts']
    }
  ]
};
