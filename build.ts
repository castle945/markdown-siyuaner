// esbuild 也是前端构建工具，速度快但不带开发服务器，常和 vite 联用
const { build } = require("esbuild")
const { resolve } = require("path")
const { existsSync } = require("fs")
const { copy } = require("esbuild-plugin-copy")
// 检查命令行参数中是否包含 --mode=production，以判断当前是开发还是生产模式
const isProd = process.argv.indexOf('--mode=production') >= 0;

// 定义依赖项数组，这些依赖项将被外部化，即不会被打包进最终输出，但在运行时仍然需要，类似 C++ 的动态链接库
const dependencies = ['vscode-html-to-docx', 'highlight.js', 'pdf-lib', 'cheerio', 'katex', 'mustache', 'puppeteer-core']

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
        // logLevel: 'error',
        metafile: true,
        // sourceRoot: __dirname+"/src",
        // 根据是否为生产模式决定是否压缩代码
        minify: isProd,
        // 如果不是生产模式，则启用监听模式自动重新构建
        watch: !isProd,
        sourcemap: !isProd,
        logOverride: {
            'duplicate-object-key': "silent",
            'suspicious-boolean-not': "silent",
        },
        // 使用插件来复制静态文件并提供构建开始和结束的通知
        plugins: [
            {
                name: 'build notice',
                setup(build) {
                    build.onStart(() => {
                        console.log('build start')
                    })
                    build.onEnd(() => {
                        console.log('build success')
                    })
                }
            },
        ],
    })
}

// 创建库函数
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

createLib();
main();