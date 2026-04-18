import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.d.ts'],
  format: 'esm',
  dts: true,
  unbundle: true,
  outDir: 'dist',
  clean: false,
  copy: { from: 'src/prompts/specs', to: 'dist/prompts' },
})
