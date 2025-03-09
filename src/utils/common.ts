import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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
export function parseImageSavePath(uri: vscode.Uri, assetsPath: string) {
    const fileName = ("${fileName}/${now}.png").replace("${fileName}", path.parse(uri.fsPath).name.replace(/\s/g, '')).replace("${now}", new Date().getTime() + "")
    const parsedAssetsDir = assetsPath.replace("${workspaceFolder}", getWorkspacePath(uri)).replace("${documentFolder}", path.parse(uri.fsPath).dir)
    const fullPath = parsedAssetsDir + "/" + fileName;
    return { fileName, fullPath };
}
export function getWorkspacePath(uri: vscode.Uri): string {
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

// 给定目录路径，获取该目录下所有文件名
export async function getFileNamesFromDirectory(directoryPath: string) {
    const filesWithDirs = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    // 过滤掉子目录
    const fileNames = filesWithDirs.filter(dirent => dirent.isFile()).map(dirent => dirent.name); // 获取文件名
    return fileNames;
}
