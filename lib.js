// @tag delete: 无用代码，似乎是 build.ts 的冗余
const { build } = require("esbuild");
const { resolve } = require("path");
const { existsSync } = require("fs");
const dependencies = require("./package.json").dependencies

const points = Object.keys(dependencies).reduce((point, dependency) => {
    const main = require(`./node_modules/${dependency}/package.json`).main ?? "index.js";
    const mainAbsPath = resolve(`./node_modules/${dependency}`, main);
    if (existsSync(mainAbsPath)) {
        point[dependency] = mainAbsPath;
    }
    return point;
}, {})
console.log(points)

build({
    entryPoints: points,
    bundle: true,
    outdir: "out/lib",
    format: 'cjs',
    platform: 'node',
    minify: true,
    treeShaking: true,
    metafile: true,
    external: ['vscode']
})