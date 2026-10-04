import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/kuru/*.ts', 'src/seal.ts', 'src/mera.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { perFile: true, lines: 95 },
    },
  },
})
