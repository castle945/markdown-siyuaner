import * as vscode from 'vscode';

// 适配 windows 系统，遍历 A-Z 获取盘符路径 C:/ 等
export function getFolders(): vscode.Uri[] {
    const data = [];
    for (let i = 65; i <= 90; i++) {
        data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`));
    }
    return data;
}
