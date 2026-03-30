import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]

// Allow overriding base path via env var, and auto-detect repo path on GitHub Actions.
const base = process.env.VITE_BASE_PATH || (isGitHubActions && repositoryName ? `/${repositoryName}/` : '/')

export default defineConfig({
  base,
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});