import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // 监听所有网卡，局域网内其他设备可通过本机 IP 访问；端口固定为 1238
  server: { host: true, port: 1238, strictPort: true },
  preview: { host: true, port: 1238, strictPort: true },
})
