import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss'

export default defineConfig({
  root: 'src/web-remote',
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()]
    }
  },
  build: {
    outDir: '../../resources/web-remote',
    emptyOutDir: true
  }
})
