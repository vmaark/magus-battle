import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const githubRepository = process.env.GITHUB_REPOSITORY
const githubPagesBase = githubRepository ? `/${githubRepository.split('/')[1]}/` : '/'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? githubPagesBase : '/',
  plugins: [react()],
  resolve: {
    alias: {
      'magus-battle-simulator': fileURLToPath(
        new URL('../magus-battle-simulator/src/index.ts', import.meta.url),
      ),
    },
  },
})
