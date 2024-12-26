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
    const { config } = extparam;
    window.editor = new Vditor('vditor', {
        value: extparam.content,
        height: document.documentElement.clientHeight,
        cache: {
            enable: false,
        },
        mode: "wysiwyg",
        outline: {
            enable: config.showOutline,
            position: 'left',
        },
        toolbar: getToolbar(),
        preview: {
            theme: {
                current: config.editorContentTheme,
                // path: `${extparam.vditorPath}/css/content-theme`, // 自定义主题路径
            },
            hljs: {
                style: config.codeTheme,
                lineNumber: true,
            },
        },
        after() {
            setLinkClickCallback();
            setToolbarClick(window.editor.vditor.options);
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
    });
}).emit("init") // @! 逻辑的起点，webview.html->此 JS 发射 init 事件，插件 handler 的 init 回调函数中发射 open 事件并携带文档内容等参数，此脚本中的窗口 handler 的 open 回调函数创建 Vditor 实例


////////////////////////////////////////////////////////////////////////////////
// 
// 自定义设置
// 
////////////////////////////////////////////////////////////////////////////////
// 自定义工具栏配置，默认配置见 vditor 代码库搜索 'class Options'
function getToolbar() {
    return [
        "outline",
        "content-theme",
        "code-theme",
        "|",
        "headings",
        "bold",
        "italic",
        "strike",
        "link",
        "|",
        "list",
        "ordered-list",
        "check",
        "outdent",
        "indent",
        "|",
        "quote",
        "line",
        "code",
        "inline-code",
        "insert-before",
        "insert-after",
        "|",
        "upload",
        "table",
        "|",
        "undo",
        "redo",
        "|",
        {
            name: "more",
            toolbar: [
                "both",
                "edit-mode",
                "export",
                "preview",
                "info",
                "help",
            ],
        },
    ];
}
// "[{(' 等符号配对，和自定义快捷键，但会影响打字速度
const keys = ['{', '[', '(', '\'', '"']; // 分别对应 [{ '" 9(
const keyMapping = {'{': '}', '[': ']', '(': ')', '\'' : '\'', '"': '"'};
window.addEventListener('keydown', async (e) => {
    if (!keys.includes(e.key)) return; // 检查是否是需要处理的键
    // 插入匹配的字符并移动光标
    selectText = document.getSelection().toString();
    document.execCommand('insertText', false, selectText + keyMapping[e.key]); // 键盘按下时已插入左半边字符
    document.getSelection().modify('move', 'left', 'character');
})
// 设置点击链接事件的回调函数，Vditor 原生不支持
function setLinkClickCallback() {
    // 所见即所得模式(wysiwyg)下的超链接处理
    document.querySelector(".vditor-wysiwyg").addEventListener('click', e => {
        e.stopPropagation();        // 阻止事件冒泡到父元素
        // 如果是文本链接或图片链接，则发射 openLink 事件
        if (e.target.tagName == 'A') {
            handler.emit("openLink", e.target.href)
        } 
        else if (e.target.tagName == 'IMG') {
            // 图片链接检查其父元素，如果父元素为链接或包含 href 属性
            const parent = e.target.parentElement;
            if (parent?.tagName == 'A' && parent.href) {
                handler.emit("openLink", parent.href)
                return;
            }
        }
    });
}
// 设置工具栏点击事件的回调函数，用于保存工具栏状态
function setToolbarClick(options) {
    document.querySelector(".vditor-toolbar").addEventListener('click', e => {
        let target = e.target, type; // 声明一个 type 变量，值为 undefined
        for (let i = 0; i < 3; i++) {
            if (type = target.dataset.type) break; // 查找 data-type 的属性，并为 type 赋值，如 data-type="button" 则 type="button"
            target = target.parentElement;
        }
        if (type == 'outline') {
            handler.emit("saveToolbarToConfig", {key: "showOutline", value: options.outline.enable});
        }
    });
}
