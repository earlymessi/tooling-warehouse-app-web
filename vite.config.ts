import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'
import pkg from './package.json'

const mainExternals = ['electron', ...Object.keys(pkg.dependencies)]

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    ...(mode === 'test' ? [] : [renderer()]),
    ...(mode === 'test'
      ? []
      : [
          electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: mainExternals,
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    }),
        ]),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}))
