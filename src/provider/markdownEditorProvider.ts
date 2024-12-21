import { adjustImgPath, getWorkspacePath, writeFile } from '@/common/fileUtil';
import { readFileSync, writeFileSync } from 'fs';
import { basename, isAbsolute, parse, resolve } from 'path';
import * as vscode from 'vscode';
import { Handler } from '../common/handler';
import { Util } from '../common/util';
import { Holder } from '../service/markdown/holder';
import { MarkdownService } from '../service/markdownService';
import { Global } from '@/common/global';
import { platform } from 'os';

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {

    private extensionPath: string;
    // 状态栏显示 md 文件的行数字数统计
    private countStatus: vscode.StatusBarItem;
    private state: vscode.Memento;

    constructor(private context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
        this.countStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.state = context.globalState
    }
    // 该类的主逻辑，默认不加也是 public
    public resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {
        const uri = document.uri;
        const webview = webviewPanel.webview;
        // md 文件所在目录
        const folderPath = vscode.Uri.joinPath(uri, '..')
        webview.options = {
            // 允许在 Webview 中执行 JavaScript
            enableScripts: true,
            // 设置本地资源根路径列表，确保 Webview 可以加载这些路径下的资源，这里包括了根路径 / 和从 this.getFolders() 方法获取的其他文件夹路径
            // 对于 linux/mac 设置 / 即可，windows 系统需要设置多个盘符路径，如 C:/ D:/ 等
            localResourceRoots: [vscode.Uri.file("/"), ...this.getFolders()]
        }
        // Handler 实例，用于与 Webview 通信
        const handler = Handler.bind(webviewPanel, uri);
        this.handleMarkdown(document, handler, folderPath)
        // 监听名为 'developerTool' 的事件，当此事件触发时，会执行命令 workbench.action.toggleDevTools，这将切换 VS Code 的开发者工具（DevTools），以便调试 Webview 内容
        handler.on('developerTool', () => vscode.commands.executeCommand('workbench.action.toggleDevTools'))
    }
    // 适配 windows 系统，遍历 A-Z 获取盘符路径 C:/ 等
    private getFolders(): vscode.Uri[] {
        const data = [];
        for (let i = 65; i <= 90; i++) {
            data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`))
        }
        return data;
    }
    // 处理 md 文件
    private handleMarkdown(document: vscode.TextDocument, handler: Handler, folderPath: vscode.Uri) {
        const uri = document.uri;
        const webview = handler.panel.webview;

        let content = document.getText();
        // 设置资源路径，指向插件资源目录下的 vditor 文件夹
        const contextPath = `${this.extensionPath}/resource/vditor`;
        // 将资源路径转换为 Webview 可访问的 URI 并转换为字符串形式
        const rootPath = webview.asWebviewUri(vscode.Uri.file(`${contextPath}`)).toString();

        // 更新全局变量 Holder.activeDocument 以跟踪当前活动的文档
        Holder.activeDocument = document;
        // Webview 面板的视图状态变化钩子函数，当面板可见时显示计数器，不可见时隐藏计数器
        handler.panel.onDidChangeViewState(e => {
            Holder.activeDocument = e.webviewPanel.visible ? document : Holder.activeDocument
            if (e.webviewPanel.visible) {
                this.updateCount(content)
                this.countStatus.show()
            } else {
                this.countStatus.hide()
            }
        });

        // 初始化一个时间戳变量，用于防止频繁保存
        let lastManualSaveTime: number;
        // 获取插件配置，见 package.json
        const config = vscode.workspace.getConfiguration("vscode-office");
        // 各种事件的钩子函数
        handler.on("init", () => {
            // Webview 面板初始化完成时触发，emit 发射一个 open 事件，通知 Webview 加载 md 文件内容
            const scrollTop = this.state.get(`scrollTop_${document.uri.fsPath}`, 0);
            handler.emit("open", {
                title: basename(uri.fsPath),
                config, scrollTop,
                language: vscode.env.language,
                rootPath, content
            })
            // 状态栏更新行数字数统计
            this.updateCount(content)
            this.countStatus.show()
        }).on("externalUpdate", e => {
            // 处理外部更新事件，即文档内容因非本编辑面板修改而发生改变时（例如 vim 修改）触发
            // 如果 lastManualSaveTime 有值（undefined 为 false），并且距离上次保存时间小于 800 毫秒，则忽略本次保存
            if (lastManualSaveTime && Date.now() - lastManualSaveTime < 800) return;
            // 更新文档内容并触发更新通知
            const updatedText = e.document.getText()?.replace(/\r/g, '');
            if (content == updatedText) return;
            content = updatedText;
            this.updateCount(content)
            // 发射一个 update 事件，通知 Webview 更新内容
            handler.emit("update", updatedText)
        }).on("command", (command) => {
            // 处理命令事件，例如 Webview 内点击按钮、内嵌 JavaScript 脚本调用等触发的 VS Code 命令
            vscode.commands.executeCommand(command)
        }).on("openLink", (uri: string) => {
            // 处理链接点击事件，根据 URL 格式决定是内部打开还是外部打开链接
            // /.../ 中定义正则表达式，匹配 https://file.*.net 模式，i 表示忽略大小写，但是不知道为啥要匹配这个模式
            const resReg = /https:\/\/file.*\.net/i;
            if (uri.match(resReg)) {
                // 例如将 https://file.example.net/path/to/resource.md 替换为 /path/to/resource.md
                const localPath = uri.replace(resReg, '')
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(localPath));
            } else {
                vscode.env.openExternal(vscode.Uri.parse(uri));
            }
        }).on("scroll", ({ scrollTop }) => {
            // 处理滚动事件，用户滚动、页面加载自动滚动时触发，scrollTop 参数保存之前滚动的位置并以文档路径作为键名
            this.state.update(`scrollTop_${document.uri.fsPath}`, scrollTop)
        }).on("img", async (img) => {
            // Webview 内部处理图片上传或接收图片数据时触发
            const { relPath, fullPath } = adjustImgPath(uri)
            const imagePath = isAbsolute(fullPath) ? fullPath : `${resolve(uri.fsPath, "..")}/${relPath}`.replace(/\\/g, "/");
            writeFileSync(imagePath, Buffer.from(img, 'binary'))
            const fileName = parse(relPath).name;
            const adjustRelPath = await MarkdownService.imgExtGuide(imagePath, relPath);
            vscode.env.clipboard.writeText(`![${fileName}](${adjustRelPath})`)
            vscode.commands.executeCommand("editor.action.clipboardPasteAction")
        }).on("quickOpen", () => {
            vscode.commands.executeCommand('workbench.action.quickOpen');
        }).on("editInVSCode", (full: boolean) => {
            const side = full ? vscode.ViewColumn.Active : vscode.ViewColumn.Beside;
            vscode.commands.executeCommand('vscode.openWith', uri, "default", side);
        }).on("save", (newContent) => {
            if (lastManualSaveTime && Date.now() - lastManualSaveTime < 800) return;
            content = newContent
            this.updateTextDocument(document, newContent)
            this.updateCount(content)
        }).on("doSave", async (content) => {
            lastManualSaveTime = Date.now();
            await this.updateTextDocument(document, content)
            this.updateCount(content)
            vscode.commands.executeCommand('workbench.action.files.save');
        }).on("export", (option) => {
            vscode.commands.executeCommand('workbench.action.files.save');
            new MarkdownService(this.context).exportMarkdown(uri, option)
        }).on("theme", async (theme) => {
            // 顶栏主题设置按钮
            // 如果没定义 markdown 主题则弹出主题选择框，选择后再发送 'theme' 事件并更新全局配置项
            if (!theme) {
                const themes = [
                    "Auto", "|",
                    "Light", "Solarized", "Warm Light", "Dim Light", "|",
                    "One Dark", "Github Dark",
                    "Nord", "Monokai", "Dracula",
                ];
                const editorTheme = Global.getConfig('editorTheme');
                const themeItems: vscode.QuickPickItem[] = themes.map(theme => {
                    if (theme == '|') return { label: '|', kind: vscode.QuickPickItemKind.Separator }
                    return { label: theme, description: theme == editorTheme ? 'Current' : undefined }
                })
                theme = await vscode.window.showQuickPick(themeItems, { placeHolder: "Select Editor Theme" });
                if (!theme) return
            }
            handler.emit('theme', theme.label)
            Global.updateConfig('editorTheme', theme.label)
        }).on("saveOutline", (enable) => {
            config.update("openOutline", enable, true)
        }).on('developerTool', () => {
            vscode.commands.executeCommand('workbench.action.toggleDevTools')
        })

        // 设置 webview 页面为 resource/vditor/index.html
        // Markdown 插件的逻辑，设置 webview 的页面为 index.html 随后在 html 中的操作都由 vditor 库中的 js 代码完成，随后保存时触发 save 事件调用 updateTextDocument 方法替换文档内容
        const basePath = Global.getConfig('workspacePathAsImageBasePath') ?
            vscode.Uri.file(getWorkspacePath(folderPath)) : folderPath;
        const baseUrl = webview.asWebviewUri(basePath).toString().replace(/\?.+$/, '').replace('https://git', 'https://file');
        webview.html = Util.buildPath(
            readFileSync(`${this.extensionPath}/resource/vditor/index.html`, 'utf8')
                .replace("{{rootPath}}", rootPath)
                .replace("{{baseUrl}}", baseUrl)
                .replace(`{{configs}}`, JSON.stringify({
                    platform: platform()
                })),
            webview, contextPath);
    }

    private updateCount(content: string) {
        this.countStatus.text = `Line ${content.split(/\r\n|\r|\n/).length}    Count ${content.length}`
    }

    private updateTextDocument(document: vscode.TextDocument, content: any) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), content);
        return vscode.workspace.applyEdit(edit);
    }

}