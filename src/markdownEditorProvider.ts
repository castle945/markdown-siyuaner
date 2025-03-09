import * as vscode from 'vscode';
import { getFolders, buildPath, parseImageSavePath, getWorkspacePath, getFileNamesFromDirectory } from './utils/common';
import { Handler } from './utils/handler';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rename } from 'fs';
import { dirname, join, parse, relative } from 'path';

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
    private extensionPath: string;
    private handler: Handler; // @! Handler 实例，用于和 webview 通信，向其发射事件，此变量的赋值由于无法在构造函数中进行，有点不常规，但是逻辑上应该没错，resolveCustomTextEditor 要先于其他函数执行
    private state: vscode.Memento;

    constructor(private context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
        this.state = context.globalState;
    }
    // 该类的主逻辑，默认不加也是 public
    public resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {
        const uri = document.uri;
        const webview = webviewPanel.webview;
        this.handler = Handler.bind(webviewPanel, uri); // Handler 实例，用于链式设置事件的钩子函数

        webview.options = {
            enableScripts: true, // 允许在 Webview 中执行 JavaScript
            // 设置本地资源根路径列表，确保 Webview 可以加载这些路径下的资源，这里包括了根路径 / 和从 getFolders() 方法获取的其他文件夹路径
            // 对于 linux/mac 设置 / 即可，windows 系统需要设置多个盘符路径，如 C:/ D:/ 等
            localResourceRoots: [vscode.Uri.file("/"), ...getFolders()]
        };
        
        const contextPath = `${this.extensionPath}/resource/vditor`; // 设置资源路径，指向插件资源目录下的 vditor 文件夹
        const config = vscode.workspace.getConfiguration("markdown-siyuaner"); // 获取插件配置，见 package.json
        const vditorPath = webview.asWebviewUri(vscode.Uri.file(`${contextPath}`)).toString();
        // 设置各种事件的钩子函数，由 webview 中的 window.handler 发射相应事件时触发
        this.handler.on("init", () => {
            // 向 webview 发射一个 open 事件，携带一些参数，包括当前文档内容
            const scrollTop = this.state.get(`scrollTop_${document.uri.fsPath}`, 0);
            this.handler.emit("open", {
                content: document.getText(), config, 
                scrollTop, vditorPath
            })
        }).on("save", (newContent) => {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), newContent);
            vscode.workspace.applyEdit(edit);
        }).on("uploadOrPasteImage", async (image) => {
            // 保存 webview 获取到的图片数据到指定目录
            const { fileName, fullPath } = parseImageSavePath(uri, config.get<string>('assetsPath'));
            if (!existsSync(dirname(fullPath))) mkdirSync(dirname(fullPath), { recursive: true });
            writeFileSync(fullPath, Buffer.from(image, 'binary'));
            const relPath = relative(dirname(uri.fsPath), fullPath);
            const mdImgTxt = `![${parse(fileName).base}](${relPath})`;
            vscode.env.clipboard.writeText(mdImgTxt);
            vscode.env.clipboard.readText().then(
                clipText => {
                    // code-server 中 clipboard.writeText 会失效，弹出一个提示信息显示图片链接，凑合用吧
                    if (clipText !== mdImgTxt) vscode.window.showInformationMessage(mdImgTxt);
                }
              );
            vscode.commands.executeCommand("editor.action.clipboardPasteAction")
        }).on("openLink", (uri: string) => {
            // webview 发送该事件时触发，调用 API 打开链接
            const resReg = /^https:\/\/\S+\.net(\/|$)/; // VSCode 打开的工作区文件都是以 https://*.net 模式的
            if (uri.match(resReg)) {
                const localPath = uri.replace(resReg, '/')
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(localPath));
            } else {
                // 否则为外部链接，直接调用 API 打开
                vscode.env.openExternal(vscode.Uri.parse(uri));
            }
        }).on("saveToolbarToConfig", (param) => {
            // 保存大纲等设置
            const { key, value } = param;
            config.update(key, value, true); // true 表示更新全局设置，false 表示仅更新当前工作区设置
        }).on("scroll", ({ scrollTop }) => {
            this.state.update(`scrollTop_${document.uri.fsPath}`, scrollTop);
        }).on("fixlink", async ()=> {
            await this.fixAssetsLink(uri);
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

    // 切换 Markdown 编辑器
    public switchEditor(uri: vscode.Uri) {
        // 当在 webview 下点击切换按钮时，获取到的 editor 为 undefined 否则在默认编辑器下点击则为 editor 实例
        const editor = vscode.window.activeTextEditor;
        const type = editor ? 'siyuaner.markdownViewer' : 'default';
        vscode.commands.executeCommand('vscode.openWith', uri, type);
        // 切换编辑器时，切换到默认编辑器能获取到 webview 未保存的编辑，但切换到 webview 时不会更新编辑器内容
        if (type === 'siyuaner.markdownViewer') {
            this.handler.emit("updateContent", editor.document.getText());
        }
    }
    // 修复 Markdown 文档中的链接，删除未引用的资源
    public async fixAssetsLink(uri: vscode.Uri) {
        vscode.window.showInformationMessage("提示: 修复 Markdown 文档中的链接，当资源目录移动、重命名 或 当前文档移动时使用");
        vscode.window.showInformationMessage("提示: 删除未引用的资源，仅限本插件生成的图片即 fileName/now.png 格式");

        // @# 如果找不到 [assetsPath: 资源目录]，可能其被移动或重命名，弹窗提示用户输入资源目录新路径并更新配置
        const config = vscode.workspace.getConfiguration("markdown-siyuaner"); // 获取插件配置，见 package.json
        const workspaceDir = getWorkspacePath(uri);
        const assetsPath = config.get<string>('assetsPath');
        let parsedAssetsDir = assetsPath.replace("${workspaceFolder}", workspaceDir).replace("${documentFolder}", parse(uri.fsPath).dir);
        if (assetsPath.startsWith("${documentFolder}") && !existsSync(parsedAssetsDir)) {
            // 特殊情况处理，当以 ${workspaceFolder} 开头时，资源目录路径可以不存在，从而切换到工作区中任何目录
            // 但当 ${documentFolder} 此路径开头时，资源目录路径必须存在，因为文档当前路径，没有可切换的选项，除非手动新建该路径
            mkdirSync(parsedAssetsDir, { recursive: true });
        }
        if (!existsSync(parsedAssetsDir)) {
            const inputBox1 = await vscode.window.showErrorMessage(
                "检测到无法找到资源目录\n可能是该目录被移动或重命名", { modal: true }).then(() => {
                    return vscode.window.showInputBox({
                        prompt: "请输入资源目录新路径以重新配置，支持变量 ${workspaceFolder} ${documentFolder}",
                        value: config.get<string>('assetsPath'),
                        ignoreFocusOut: true, // 当焦点移动到编辑器的另一部分或另一个窗口时, 保持输入框打开
                    });
                });
            if (inputBox1) {
                parsedAssetsDir = inputBox1.replace("${workspaceFolder}", workspaceDir).replace("${documentFolder}", parse(uri.fsPath).dir);
                if (!existsSync(parsedAssetsDir)) {
                    vscode.window.showErrorMessage("输入的资源目录路径不存在，请重试", { modal: true });
                    return;
                } 
                else await config.update("assetsPath", inputBox1, true);
            }
            else return;
        }
        // @# 如果当前文档的资源目录不存在，可能是当前文档的资源目录被移动或当前文档被重命名
        const mdFileName = parse(uri.fsPath).name.replace(/\s/g, '');
        let curAssetsDir = join(parsedAssetsDir, mdFileName);
        if (!existsSync(curAssetsDir)) {
            const inputBox2 = await vscode.window.showErrorMessage(
                "检测到无法找到当前文档的资源目录\n可能是当前文档的资源目录被移动或当前文档被重命名\n" + 
                "可以不输入，手动在工作区调整资源目录\n或者在输入框中输入", { modal: true }).then(() => {
                    return vscode.window.showInputBox({
                        prompt: "请输入原来的文档资源目录，将移动此目录",
                        value: join(config.get<string>('assetsPath'), mdFileName),
                        ignoreFocusOut: true, 
                    });
                });
            if (inputBox2) {
                const oldCurAssetsDir = inputBox2.replace("${workspaceFolder}", workspaceDir).replace("${documentFolder}", parse(uri.fsPath).dir);
                if (!existsSync(oldCurAssetsDir)) {
                    vscode.window.showErrorMessage("输入的当前文档的资源目录路径不存在，请重试", { modal: true });
                    return;
                } 
                else rename(oldCurAssetsDir, curAssetsDir, (err) => {
                    if (err) vscode.window.showErrorMessage("移动当前文档的资源目录失败", { modal: true });
                });
            }
            else return;
        }

        // 获取文档内容
        const document = await vscode.workspace.openTextDocument(uri);
        let content = document.getText(); // 获取到的是实时修改未保存的文档内容
        // 正则表达式匹配 Markdown 图片链接
        const imageRegex = /!\[.*?\]\((?!http:\/\/|https:\/\/)(.*?)\)/g;
        const imageLinks: string[] = []; // 用于存储匹配到的图片链接
        const imageNames: string[] = []; // 用于存储匹配到的图片链接的文件名，即 UTC 时间戳
        let match;
        while ((match = imageRegex.exec(content)) !== null) {
            imageLinks.push(match[1]); // match[0] 为完整图片链接，match[1] 为小括号内的相对路径
            imageNames.push(parse(match[1]).name);
        }
        // 获取当前文档资源目录所有文件名
        const fileNames = await getFileNamesFromDirectory(curAssetsDir);
        // @# 将 UTC 时间戳视为某个资源的唯一标识进行配对，对于每个资源文件，遍历所有图片链接，如果没有匹配到则认为其未引用
        let pairs: [number, number][] = [];
        let unusedImages: number[] = []; // 未引用的图片索引
        for (let i = 0; i < fileNames.length; i++) {
            const basename = parse(fileNames[i]).name;
            let success = false;
            for (let j = 0; j < imageNames.length; j++) {
                if (basename === imageNames[j]) { // === 是严格相等，如何类型不同也不相等，而 == 如果类型不同则会进行类型转换再比较
                    success = true;
                    pairs.push([i, j]);
                    break;
                }
            }
            if (!success) unusedImages.push(i);
        }
        // @# 弹窗提示用户是否删除未引用的资源
        if (unusedImages.length > 0) {
            let tips = "未引用文件列表：\n";
            for (let i = 0; i < unusedImages.length; i++) {
                tips += fileNames[unusedImages[i]] + "\n";
            }
            const result = await vscode.window.showInformationMessage(
                "检测到当前文档有未引用的资源，是否删除？\n\n" + tips, 
                { modal: true }, "删除"
            );
            if (result === "删除") {
                for (let i = 0; i < unusedImages.length; i++) {
                    const filePath = join(curAssetsDir, fileNames[unusedImages[i]]);
                    try {
                        await vscode.workspace.fs.delete(vscode.Uri.file(filePath));
                    } catch (error) {
                        vscode.window.showErrorMessage("删除文件失败：" + filePath, { modal: true });
                    }
                }
            }
        }
        if (pairs.length === 0) return;
        // @# 如果存在有效链接和资源对，则进行链接修复
        // 检测文档路径是否被修改
        const mdRelpath = relative(dirname(uri.fsPath), curAssetsDir); // 链接的相对路径应为此值
        const curMdRelpath = dirname(imageLinks[pairs[0][1]]); // 实际根据文档内容判断的相对路径
        if (mdRelpath !== curMdRelpath) vscode.window.showInformationMessage("检测到文档路径被修改，即将修复文档中的链接");
        // 修复文档中的链接
        for (let i = 0; i < pairs.length; i++) {
            const [index, linkIndex] = pairs[i];
            const oldLink = imageLinks[linkIndex];
            const newLink = join(mdRelpath, fileNames[index]);
            content = content.replace(oldLink, newLink);
        }
        // 更新文档内容
        this.handler.emit("updateContent", content);
    }
}