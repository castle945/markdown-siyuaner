// 前端构造工具 vite 配置文件，esbuild 也是前端构建工具，速度快但不带开发服务器，可以和 vite 联用
// vite 和 esbuild 的关系类似 C++ 的 CMake 和 Makefile
import { defineConfig } from 'vite'
import { build } from "esbuild";
import { resolve } from "path";
import { existsSync } from "fs";
// 所有命令行参数用 ',' 拼接成一个字符串，再判断其中是否包含 'mode'
const hasMode = process.argv.join(',').includes('mode');
// 检查命令行参数中是否包含 --mode=production，以判断当前是开发还是生产模式
const isProd = process.argv.indexOf('--mode=production') >= 0;

// 定义依赖项数组，这些依赖项将被外部化，即不会被打包进最终输出，但在运行时仍然需要，类似 C++ 的动态链接库
// 具体来说，不会打包到 extension.js 中，而是逐个打包到 out/node_modules 目录下，修改 .vsix 为 .zip 再解压可以看到打包后的插件代码结构
const dependencies = ['highlight.js', 'cheerio', 'mustache', 'puppeteer-core']
// 执行将 dependencies 依赖库打包到 out/node_modules 目录下
function createLib() {
  // 遍历 dependencies 数组，读取每个依赖项的 package.json 文件，找到其主入口文件（main 字段）
  const points = dependencies.reduce((point, dependency) => {
      const main = require(`./node_modules/${dependency}/package.json`).main ?? "index.js";
      const mainAbsPath = resolve(`./node_modules/${dependency}`, main);
      // 如果该入口文件存在，则将其添加到 entryPoints 对象中
      if (existsSync(mainAbsPath)) {
          point[dependency] = mainAbsPath;
      }
      return point;
  }, {})
  // 执行构建，将这些依赖项单独打包到 out/node_modules 目录下
  build({
      entryPoints: points,
      bundle: true,
      outdir: "out/node_modules",
      format: 'cjs',
      platform: 'node',
      minify: true,
      treeShaking: true,
      metafile: true
  })
}
// 插件构建主函数
function main() {
  build({
      // 入口文件
      entryPoints: ['./src/extension.ts'],
      // 将所有依赖项捆绑在一起
      bundle: true,
      outfile: "out/extension.js",
      // 列出应外部化的依赖库，即动态链接库
      external: ['vscode', ...dependencies],
      // 输出格式为 CommonJS 模块
      format: 'cjs',
      platform: 'node',
      metafile: true,
      // 根据是否为生产模式决定是否压缩代码
      minify: isProd,
      // 如果不是生产模式，则启用监听模式自动重新构建
      watch: !isProd,
      sourcemap: !isProd,
      logOverride: {
          'duplicate-object-key': "silent",
          'suspicious-boolean-not': "silent",
      },
  })
}

if (hasMode) {
  createLib();
  main();
}

// 定义并导出 Vite 的配置对象，更多配置项参考 https://vitejs.dev/config/
// 启动开发服务器，显示当前目录的 index.html 文件
export default defineConfig({
  // npm run dev 时，开发服务器监听的端口号
  server: {
    host: '127.0.0.1',
    port: 5739
  },
  // 空字符串表示以相对路径形式引用资源文件
  base: '',
  // 指定构建输出目录和代码块大小阈值
  build: {
    outDir: 'out/webview',
    chunkSizeWarningLimit: 2048,
  }
})
