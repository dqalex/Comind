import { defineConfig } from 'vitest/config';
import path from 'path';

// 测试环境变量
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-key-for-testing-only-32chars';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/core\/(.*)$/, replacement: path.resolve(__dirname, './src/core/$1') },
      { find: /^@\/shared\/(.*)$/, replacement: path.resolve(__dirname, './src/shared/$1') },
      { find: /^@\/domains\/(.*)$/, replacement: path.resolve(__dirname, './src/domains/$1') },
      { find: /^@\/features\/(.*)$/, replacement: path.resolve(__dirname, './src/features/$1') },
      { find: /^@\/src\/(.*)$/, replacement: path.resolve(__dirname, './src/$1') },
      // 优先映射特定子目录
      { find: /^@\/lib\/openclaw\/(.*)$/, replacement: path.resolve(__dirname, './src/shared/lib/openclaw/$1') },
      { find: /^@\/lib\/sync\/(.*)$/, replacement: path.resolve(__dirname, './src/shared/lib/sync/$1') },
      { find: /^@\/lib\/chat-channel\/(.*)$/, replacement: path.resolve(__dirname, './src/shared/lib/chat-channel/$1') },
      { find: /^@\/lib\/services\/(.*)$/, replacement: path.resolve(__dirname, './src/shared/lib/services/$1') },
      { find: /^@\/lib\/locales\/(.*)$/, replacement: path.resolve(__dirname, './src/shared/lib/locales/$1') },
      { find: /^@\/lib\/workspace\/(.*)$/, replacement: path.resolve(__dirname, './src/shared/lib/workspace/$1') },
      { find: /^@\/lib\/(.*)$/, replacement: path.resolve(__dirname, './src/shared/lib/$1') },
      { find: /^@\/hooks\/(.*)$/, replacement: path.resolve(__dirname, './src/shared/hooks/$1') },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, './$1') },
      // mock server-only 模块，避免测试环境报错
      { find: 'server-only', replacement: path.resolve(__dirname, 'tests/__mocks__/server-only.ts') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/req/**/*.test.ts',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts', 'src/**/*.tsx', 'app/**/*.ts', 'app/**/*.tsx'],
      exclude: ['node_modules/**', '.next/**', 'tests/**'],
    },
  },
});
