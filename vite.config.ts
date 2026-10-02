import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // GitHub 的 OAuth 端点不支持浏览器跨域，开发环境下通过本地代理转发设备码登录请求。
    // 生产部署方案见 README（Cloudflare Worker 示例）。
    proxy: {
      '/gh-auth': {
        target: 'https://github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gh-auth/, ''),
      },
    },
  },
})
