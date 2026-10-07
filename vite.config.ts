import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build`        -> dist/        (static web build, relative paths, hash routing)
// `npm run build:single` -> dist-single/ (one self-contained HTML file for offline use)
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    base: './',
    plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    publicDir: single ? false : 'public',
    build: {
      outDir: single ? 'dist-single' : 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 2500,
      assetsInlineLimit: single ? 100_000_000 : 4096,
    },
  }
})
