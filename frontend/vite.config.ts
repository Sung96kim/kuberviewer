import { defineConfig } from 'vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    viteReact(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
