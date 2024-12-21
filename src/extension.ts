import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './provider/markdownEditorProvider';
import { OfficeViewerProvider } from './provider/officeViewerProvider';
import { HtmlService } from './service/htmlService';
import { MarkdownService } from './service/markdownService';
import { Output } from './common/Output';
import { FileUtil } from './common/fileUtil';
import { ReactApp } from './common/reactApp';
const httpExt = require('./bundle/extension');

// 插件激活时执行
export function activate(context: vscode.ExtensionContext) {
	// keepOriginDiff();
	activeHTTP(context)
	const viewOption = { webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true } };
	FileUtil.init(context)
	ReactApp.init(context)
	const markdownService = new MarkdownService(context);
	context.subscriptions.push(
		// 注册命令
		vscode.commands.registerCommand('office.quickOpen', () => vscode.commands.executeCommand('workbench.action.quickOpen')),
		vscode.commands.registerCommand('office.markdown.switch', (uri) => { markdownService.switchEditor(uri) }),
		vscode.commands.registerCommand('office.markdown.paste', () => { markdownService.loadClipboardImage() }),
		vscode.commands.registerCommand('office.html.preview', uri => HtmlService.previewHtml(uri, context)),
		// 注册自定义编辑器
		vscode.window.registerCustomEditorProvider("cweijan.markdownViewer", new MarkdownEditorProvider(context), viewOption),
		vscode.window.registerCustomEditorProvider("cweijan.officeViewer", new OfficeViewerProvider(context), viewOption),
	);
}

export function deactivate() { }

async function activeHTTP(context: vscode.ExtensionContext) {
	try {
		httpExt.activate(context)
	} catch (error) {
		Output.debug(error)
	}
}

// @tag delete: 无用代码，功能是如果定义下面的配置，即使用了 gitlens 等插件的 markdown 预览功能，则修改为使用默认的 markdown 编辑器打开，个人不会使用到该配置
// editorAssociations: [{"filenamePattern": "*.md"...}] settings.json 中的配置项，指定某个类型的文件使用哪个编辑器
function keepOriginDiff() {
	// 获取当前工作区的所有配置项，进而获得 editorAssociations 配置
	const config = vscode.workspace.getConfiguration("workbench");
	const configKey = 'editorAssociations'
	const editorAssociations = config.get(configKey)
	// 如果 editorAssociations 配置定义了下面的模式，则修改为使用默认 markdown 编辑器打开
	const key = '{git,gitlens,git-graph}:/**/*.{md,csv,svg}'
	if (!editorAssociations[key]) {
		const oldKey = '{git,gitlens}:/**/*.{md,csv,svg}'
		editorAssociations[oldKey] = undefined
		editorAssociations[key] = 'default'
		config.update(configKey, editorAssociations, true)
	}
}