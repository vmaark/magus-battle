import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'magus-battle-simulator': fileURLToPath(
        new URL('../magus-battle-simulator/src/index.ts', import.meta.url),
      ),
    },
  },
})
