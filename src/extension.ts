import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './markdownEditorProvider';

// 插件激活时执行
export function activate(context: vscode.ExtensionContext) {
	setEditorAssociations();
	// Webview 选项，隐藏界面时保留上下文，在 Webview 中启用查找功能
	const viewOption = { webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true } };
	const provider = new MarkdownEditorProvider(context);
	context.subscriptions.push(
		// 注册自定义编辑器
		vscode.window.registerCustomEditorProvider("siyuaner.markdownViewer", provider, viewOption),
		// 注册命令
		vscode.commands.registerCommand('siyuaner.markdown.switch', (uri) => { provider.switchEditor(uri) }),
	);
}

export function deactivate() {}

// 设置文件关联，作用等同于编辑 settings.json 中的 "workbench.editorAssociations" 字段
function setEditorAssociations() {
	const config = vscode.workspace.getConfiguration("workbench");
	const editorAssociations = config.get('editorAssociations');
	// 添加 gitlens 等插件的关联，关联到使用默认编辑器打开，以在 git diff 中禁用插件
	let key: string = '{git,gitlens}:/**/*.{md}';
	if (!editorAssociations[key]) {
		editorAssociations[key] = 'default';
		config.update('editorAssociations', editorAssociations, true);
	}
	// 删掉默认的 md 文件关联，以便默认使用本插件打开 md 文件，例如用户可能配置 "*.md": "vscode.markdown.preview.editor", 会导致每次都以默认的预览模式打开 md 文件
	key = '*.md';
	if (editorAssociations[key] !== undefined) {
		editorAssociations[key] = undefined;
		config.update('editorAssociations', editorAssociations, true);
	}
}