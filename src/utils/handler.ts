import * as vscode from 'vscode';
import { WebviewPanel } from "vscode";
import { EventEmitter } from "events";

export class Handler {
    constructor(public panel: WebviewPanel, private eventEmitter: EventEmitter) {}

    public static bind(panel: WebviewPanel, uri: vscode.Uri): Handler {
        const eventEmitter = new EventEmitter();

        const fileWatcher = vscode.workspace.createFileSystemWatcher(uri.fsPath)
        fileWatcher.onDidChange(e => {
            eventEmitter.emit("fileChange", e)
        })

        panel.onDidDispose(() => {
            fileWatcher.dispose()
            eventEmitter.emit("dispose")
        });

        // bind from webview
        panel.webview.onDidReceiveMessage((message) => {
            eventEmitter.emit(message.type, message.content)
        })
        return new Handler(panel, eventEmitter);
    }

    // on 用于设置 WebviewPanel 的监听事件
    on(event: string, callback: (content: any) => any | Promise<any>): this {
        if (event != 'init') {
            const listens = this.eventEmitter.listeners(event)
            if (listens.length >= 1) {
                this.eventEmitter.removeListener(event, listens[0] as any)
            }
        }
        this.eventEmitter.on(event, async (content: any) => {
            try {
                await callback(content)
            } catch (error) {
                vscode.window.showErrorMessage(error.message)
            }
        })
        return this;
    }

    // emit 用于 VSCode 插件向 webview 发送消息
    emit(event: string, content?: any) {
        this.panel.webview.postMessage({ type: event, content })
        return this;
    }
}
