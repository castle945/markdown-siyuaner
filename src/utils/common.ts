import * as vscode from 'vscode';

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