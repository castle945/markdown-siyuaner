import * as vscode from 'vscode';
import { getFolders } from './utils/common';
import { readFileSync } from 'fs';

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
    private extensionPath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
    }
    // 该类的主逻辑，默认不加也是 public
    public resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {
        const webview = webviewPanel.webview;
        webview.options = {
            enableScripts: true, // 允许在 Webview 中执行 JavaScript
            // 设置本地资源根路径列表，确保 Webview 可以加载这些路径下的资源，这里包括了根路径 / 和从 getFolders() 方法获取的其他文件夹路径
            // 对于 linux/mac 设置 / 即可，windows 系统需要设置多个盘符路径，如 C:/ D:/ 等
            localResourceRoots: [vscode.Uri.file("/"), ...getFolders()]
        };
        // 设置 webview 页面为 resource/vditor/index.html
        webview.html = readFileSync(`${this.extensionPath}/resource/vditor/index.html`, 'utf8');
    }
}