import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './markdownEditorProvider';

// 插件激活时执行
export function activate(context: vscode.ExtensionContext) {
	// Webview 选项，隐藏界面时保留上下文，在 Webview 中启用查找功能
	const viewOption = { webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true } };
	context.subscriptions.push(
		// 注册自定义编辑器
		vscode.window.registerCustomEditorProvider("siyuaner.markdownViewer", new MarkdownEditorProvider(context), viewOption),
		// 注册命令
		vscode.commands.registerCommand('siyuaner.markdown.switch', (uri) => { switchEditor(uri) }),
	);
}

export function deactivate() {}

// 切换 Markdown 编辑器
function switchEditor(uri: vscode.Uri) {
	const editor = vscode.window.activeTextEditor;
	if (!uri) uri = editor?.document.uri;
	const type = editor ? 'siyuaner.markdownViewer' : 'default';
	vscode.commands.executeCommand('vscode.openWith', uri, type);
}