import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    pool: 'forks',
    include: ['tests/**/*.test.ts'],
    // Cada archivo arranca PGlite (wasm) en beforeEach; con todos los workers a la vez el arranque pasa de 10 s.
    // Tiempos holgados para pruebas y ganchos, y como mucho la mitad de los núcleos (mín. 1) para no saturar la máquina.
    testTimeout: 30000,
    hookTimeout: 60000,
    teardownTimeout: 30000,
    maxWorkers: '50%',
    env: { TZ: 'UTC' },
    passWithNoTests: true,
  },
});
