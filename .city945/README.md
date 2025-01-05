# VSCode Extension Dev Notes

#### 知识点

- 教程：[VS-Code-Extension-Doc-ZH](https://liiked.github.io/VS-Code-Extension-Doc-ZH/#/get-started/your-first-extension)  [vscode-extension-samples](https://github.com/microsoft/vscode-extension-samples) [b3log-index](https://github.com/Vanessa219/b3log-index)
- .vsix 本质上就是 zip 压缩包，可以改后缀名解压查看内容文件结构
- 关于 Web Extension 的开发 [ [教程](https://code.visualstudio.com/api/extension-guides/web-extensions#develop-a-web-extension) ]
  - 在 github.dev 中正常工作的 Web Extension (往往是主题等没什么代码的插件) 采用的是浏览器端的 JS API，而桌面端插件采用的是 Node.js 及相关库，浏览器端往往缺失很多基本的库，两者代码不兼容
  - `yo code` 时选择 Web Extension 模板，调试时，只有  `chromium` 是可用的，其他 browserType 都不行
  - 私有部署的 code-server 支持桌面端插件，但是它使用社区源 [ [1](https://github.com/coder/code-server/discussions/2345) ]，需要再遵循 [教程](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions) 将插件上传到 [open-vsx](https://open-vsx.org)

#### demo0001-HelloWorld [ [1](https://juejin.cn/post/7121381959883816968) ]

```bash
# 设置 npm 国内源
npm config set registry https://registry.npmmirror.com
npm config get registry

npm install -g yo generator-code vsce
mkdir -p /root/.config/configstore
chown -R 1000:0 /root/.npm
chmod g+rwx /root /root/.config /root/.config/configstore
chmod g+rwx . # yo 要求模板代码的父目录要有组权限 https://github.com/yeoman/yeoman.io/issues/282
yo code # Markdown-SiYuaner

# F5 运行窗口，F1 运行 Hello World 命令
# 编写 package.json 和 README.md

# 打包插件为 .vsix 文件，右键安装插件
vsce package
# 发布到 vscode 插件市场
# 登录并创建一个发布者 https://marketplace.visualstudio.com
/usr/bin/vsce login city945 # 不知道咋回事存在多个版本的 vsce
/usr/bin/vsce publish
```
