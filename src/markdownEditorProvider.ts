import * as vscode from 'vscode';
import { getFolders, buildPath, parseImageSavePath } from './utils/common';
import { Handler } from './utils/handler';
import { readFileSync, writeFileSync } from 'fs';

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
    private extensionPath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
    }
    // 该类的主逻辑，默认不加也是 public
    public resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {
        const uri = document.uri;
        const webview = webviewPanel.webview;

        webview.options = {
            enableScripts: true, // 允许在 Webview 中执行 JavaScript
            // 设置本地资源根路径列表，确保 Webview 可以加载这些路径下的资源，这里包括了根路径 / 和从 getFolders() 方法获取的其他文件夹路径
            // 对于 linux/mac 设置 / 即可，windows 系统需要设置多个盘符路径，如 C:/ D:/ 等
            localResourceRoots: [vscode.Uri.file("/"), ...getFolders()]
        };
        
        const contextPath = `${this.extensionPath}/resource/vditor`; // 设置资源路径，指向插件资源目录下的 vditor 文件夹
        const config = vscode.workspace.getConfiguration("markdown-siyuaner"); // 获取插件配置，见 package.json
        const handler = Handler.bind(webviewPanel, uri); // Handler 实例，用于和 webview 通信，向其发射事件
        // 设置各种事件的钩子函数，由 webview 中的 window.handler 发射相应事件时触发
        handler.on("init", () => {
            // 向 webview 发射一个 open 事件，携带一些参数，包括当前文档内容
            handler.emit("open", {
                content: document.getText(),
            })
        }).on("save", (newContent) => {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), newContent);
            vscode.workspace.applyEdit(edit);
        }).on("uploadOrPasteImage", async (image) => {
            // 保存 webview 获取到的图片数据到指定目录
            const { fileName, relPath, fullPath } = parseImageSavePath(uri, config.get<string>('imageSavePath'));
            writeFileSync(fullPath, Buffer.from(image, 'binary'));
            vscode.env.clipboard.writeText(`![${fileName}](${relPath})`)
            vscode.commands.executeCommand("editor.action.clipboardPasteAction")
        })

        // 设置 webview 页面为 resource/vditor/index.html
        // Markdown 插件的逻辑，设置 webview 的页面为 index.html 随后在 html 中的操作都由 vditor 库中的 js 代码完成，随后保存时触发 save 事件替换文档内容
        const folderPath = vscode.Uri.joinPath(uri, '..'); // md 文件所在目录
        const baseUrl = webview.asWebviewUri(folderPath).toString().replace(/\?.+$/, '').replace('https://git', 'https://file');
        webview.html = buildPath(
            readFileSync(`${this.extensionPath}/resource/vditor/index.html`, 'utf8')
                .replace("{{baseUrl}}", baseUrl),
            webview, contextPath);
    }
}