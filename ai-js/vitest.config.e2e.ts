import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    server: {
      deps: {
        inline: [/^(?!.*vitest).*$/],
      },
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
  optimizeDeps: {
    include: ['express', '@nestjs/common', '@nestjs/core', '@nestjs/platform-express'],
  },
});
