import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 命令行参数处理，如果包含 mode 参数则动态加载 build.ts
const fromScripts = process.argv.join(',').includes('mode');
if (fromScripts) {
  require('./build')
}

// 定义并导出 Vite 的配置对象，更多配置项参考 https://vitejs.dev/config/
export default defineConfig({
  // 使用 vite 的 react 插件处理 React 相关文件
  plugins: [react()],
  // npm run dev 时，开发服务器监听的端口号
  server: {
    host: '127.0.0.1',
    port: 5739
  },
  base: '',
  // 指定构建输出目录和代码块大小阈值
  build: {
    outDir: 'out/webview',
    chunkSizeWarningLimit: 2048,
  }
})
