import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './provider/markdownEditorProvider';
import { FileUtil } from './common/fileUtil';

// 插件激活时执行
export function activate(context: vscode.ExtensionContext) {
	const viewOption = { webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true } };
	FileUtil.init(context)
	context.subscriptions.push(
		// 注册自定义编辑器
		vscode.window.registerCustomEditorProvider("cweijan.markdownViewer", new MarkdownEditorProvider(context), viewOption),
	);
}

export function deactivate() { }
