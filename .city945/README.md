# VSCode Extension Dev Notes

#### 知识点

- 教程：[VS-Code-Extension-Doc-ZH](https://liiked.github.io/VS-Code-Extension-Doc-ZH/#/get-started/your-first-extension)  [vscode-extension-samples](https://github.com/microsoft/vscode-extension-samples) [b3log-index](https://github.com/Vanessa219/b3log-index)
- .vsix 本质上就是 zip 压缩包，可以改后缀名解压查看内容文件结构

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
