import * as vscode from 'vscode';
import { parse, isAbsolute, resolve, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

// 适配 windows 系统，遍历 A-Z 获取盘符路径 C:/ 等
export function getFolders(): vscode.Uri[] {
    const data = [];
    for (let i = 65; i <= 90; i++) {
        data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`));
    }
    return data;
}

// 对 HTML 内容进行处理，如果 src 和 href 标签中包含 // 开头的相对 URL 则将其转为绝对 URL，如果 src 等标签中使用的是本地文件相对路径，则将该路径替换为 contextPath/relpath
export function buildPath(data: string, webview: vscode.Webview, contextPath: string): string {
    // ((src|href)=("|')?) 匹配 src=" 等，表示 src 和 href 标签，(\/\/) 匹配 // 表示相对 URL
    // 将相对 URL 转换为绝对 URL，$1 正则表达式的第一项，即 src=" 等
    return data.replace(/((src|href)=("|')?)(\/\/)/gi, "$1http://")
    // (?!(http|#)) 是一个负向前瞻断言，确保 URL 不是以 http 或 # 开头，.+? 懒惰匹配尽可能少的字符，直到遇到引号 " ' 结束
        .replace(/((src|href)=("|'))((?!(http|#)).+?["'])/gi, "$1" + webview.asWebviewUri(vscode.Uri.file(`${contextPath}`)) + "/$4");
}

// 解析图片保存路径
export function parseImageSavePath(uri: vscode.Uri, imageSavePath: string) {
    const imgPath = imageSavePath.replace("${fileName}", parse(uri.fsPath).name.replace(/\s/g, '')).replace("${now}", new Date().getTime() + "")
    const relPath = imgPath.replace(/\$\{workspaceDir\}\/?/, '');
    const fullPath = imgPath.replace("${workspaceDir}", getWorkspacePath(uri));
    if (!existsSync(dirname(fullPath))) { mkdirSync(dirname(fullPath)); }
    return {
        relPath, 
        fileName: parse(relPath).name, 
        // 如果配置路径没有使用 ${workspaceDir} 变量，则 fullPath 也是 relPath 故需要转换为绝对路径
        fullPath: isAbsolute(fullPath) ? fullPath : `${resolve(uri.fsPath, "..")}/${relPath}`.replace(/\\/g, "/")
    };
}
function getWorkspacePath(uri: vscode.Uri): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length == 0) return '';
    const workspacePath = folders[0]?.uri?.fsPath;
    if (folders.length > 1) {
        for (const folder of folders) {
            if (uri.fsPath.includes(folder.uri.fsPath)) {
                return folder.uri.fsPath;
            }
        }
    }
    return workspacePath;
}