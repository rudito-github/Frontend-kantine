/*******************************************************************************
 * @Author                : rudito-github<rudi.neuss@t-online.de>              *
 * @CreatedDate           : 2026-05-19 17:06:56                                *
 * @LastEditors           : rudito-github<rudi.neuss@t-online.de>              *
 * @LastEditDate          : 2026-05-19 17:07:03                                *
 * @FilePath              : Online-speiseplan/frontend-kantine/vite.config.js  *
 * @CopyRight             : MerBleueAviation                                   *
 ******************************************************************************/
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const backendTarget = 'http://localhost:3083'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': backendTarget,
      '/health': backendTarget,
    },
  },
})
