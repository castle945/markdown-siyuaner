// 检查 acquireVsCodeApi 是否存在（如果在 VSCode 插件中则该函数会被定义），如果存在则会调用该函数获取 VSCode 插件的 API 实例
const vscode = typeof (acquireVsCodeApi) != "undefined" ? acquireVsCodeApi() : null;
// 封装 postMessage 函数，用于 webview 向 VSCode 插件发送消息
const postMessage = (message) => { if (vscode) { vscode.postMessage(message) } }

// 创建空对象，存储事件及其回调函数
// 将 receive 函数作为 window 的消息事件监听器，receive 函数如果消息不为空，则存储在 events 对象中
let events = {}
function receive({ data }) {
    if (!data) return;
    if (events[data.type]) {
        events[data.type](data.content);
    }
}
window.addEventListener('message', receive)
// 定义事件管理对象，作为全局变量
const getVscodeEvent = () => {
    return {
        on(event, data) {
            events[event] = data
            return this;
        },
        emit(event, data) {
            postMessage({ type: event, content: data })
        }
    }
}
window.handler = getVscodeEvent();


// 设置各种事件的钩子函数，由插件 handler 发射相应事件时触发
window.handler.on("open", async (extparam) => {
    window.editor = new Vditor('vditor', {
        value: extparam.content,
        height: document.documentElement.clientHeight,
        cache: {
            enable: false,
        },
        input(content) {
            handler.emit("save", content)
        },
        upload: {
            accept: 'image/*',
            // 在 vditor 代码库中搜索 options.upload 可以查找到相关的处理函数，包括 handler(fileList) file(fileList) filename(name) 等
            // 截图和上传的图片数据都会由此函数进行处理
            handler(fileList) {
                for (let i = 0; i < fileList.length; i++) {
                    let reader = new FileReader();
                    // reader.readAsBinaryString(fileList[i]); // 此 API 即将废弃
                    reader.readAsArrayBuffer(fileList[i]);
                    reader.onloadend = () => {
                        handler.emit("uploadOrPasteImage", reader.result)
                    };
                }
            }
        },
    })
}).emit("init")