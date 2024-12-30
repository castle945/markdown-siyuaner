// 检查 acquireVsCodeApi 是否存在（如果在 VSCode 插件中则该函数会被定义），如果存在则会调用该函数获取 VSCode 插件的 API 实例
const vscode = typeof (acquireVsCodeApi) != "undefined" ? acquireVsCodeApi() : null;
// 封装 postMessage 函数，用于 webview 向 VSCode 插件发送消息
const postMessage = (message) => { if (vscode) { vscode.postMessage(message) } }

// 当前脚本的全部配置变量
const padding_height = 20; // 页面高度上的 padding 值之和
const defaultMaxWidth = 800; // 普通模式下实际文档内容最大宽度
let wideMaxWidth = document.documentElement.clientWidth * 0.9; // 宽屏模式下实际文档内容最大宽度
let myconfig; // 由于 saveToolbarToConfig 中 config.update 只会更新配置文件不会更新变量值，故这里创建 config 对象的副本自行管理，此外另一种实现方式是在 saveToolbarToConfig 最后跟一句重新读取配置但这会引起点击略有卡顿


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
    if (!myconfig) myconfig = extparam.config;
    const { showOutline, editorContentTheme, codeTheme, showWideScreen } = myconfig;
    window.editor = new Vditor('vditor', {
        value: extparam.content,
        height: document.documentElement.clientHeight - padding_height, // 减去 padding 值
        cache: {
            enable: false,
        },
        mode: "wysiwyg",
        outline: {
            enable: showOutline,
            position: 'left',
        },
        toolbar: showWideScreen ? getToolbarWide() : getToolbar(),
        preview: {
            theme: {
                current: editorContentTheme,
                path: `${extparam.vditorPath}/css/content-theme`, // 自定义主题路径，由于 vditor 默认样式基于网页调的，在 VSCode 中显示有所不同
            },
            hljs: {
                style: codeTheme,
                lineNumber: true,
            },
            maxWidth: showWideScreen ? wideMaxWidth : defaultMaxWidth,
        },
        after() {
            setLinkClickCallback();
            setToolbarClick(window.editor.vditor.options);
            setScroll(extparam.scrollTop);
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
}).on("updateContent", async (content) => {
    window.editor.setValue(content);
    handler.emit("save", content);
}).emit("init") // @! 逻辑的起点，webview.html->此 JS 发射 init 事件，插件 handler 的 init 回调函数中发射 open 事件并携带文档内容等参数，此脚本中的窗口 handler 的 open 回调函数创建 Vditor 实例


////////////////////////////////////////////////////////////////////////////////
// 
// 自定义设置
// 
////////////////////////////////////////////////////////////////////////////////
// 自定义工具栏配置，默认配置见 vditor 代码库搜索 'class Options'
const group1 = [
    {
        name: "outline",
        tipPosition: "s",
    },
    {
        name: "content-theme",
        tipPosition: "s",
    },
    {
        name: "code-theme",
        tipPosition: "s",
    },
];
const group2 = [
    {
        name: "headings",
        tipPosition: "s",
    },
    {
        name: "bold",
        tipPosition: "s",
    },
    {
        name: "italic",
        tipPosition: "s",
    },
    {
        name: "strike",
        tipPosition: "s",
    },
    {
        name: "link",
        tipPosition: "s",
    },
];
const group3 = [
    {
        name: "list",
        tipPosition: "s",
    },
    {
        name: "ordered-list",
        tipPosition: "s",
    },
    {
        name: "check",
        tipPosition: "s",
    },
];
const group4 = [
    {
        name: "quote",
        tipPosition: "s",
    },
    {
        name: "line",
        tipPosition: "s",
    },
    {
        name: "code",
        tipPosition: "s",
    },
    {
        name: "inline-code",
        tipPosition: "s",
    },
];
const group5 = [
    {
        name: "upload",
        tipPosition: "s",
    },
    {
        name: "table",
        tipPosition: "s",
    },
    {
        // 工具栏中添加自定义按钮
        name: 'fixlink',
        tipPosition: 's',
        tip: '修复文档中的链接',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="256" height="256" viewBox="0 0 256 256" xml:space="preserve"><defs></defs><g style="stroke: none; stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: none; fill-rule: nonzero; opacity: 1;" transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)" ><path d="M 69.243 90 c -5.389 0 -10.67 -2.107 -14.643 -6.081 c -5.433 -5.432 -7.391 -13.514 -5.115 -20.831 L 26.912 40.515 c -7.313 2.276 -15.397 0.32 -20.832 -5.114 c -5.933 -5.933 -7.705 -14.784 -4.514 -22.549 l 0.846 -2.059 l 12.493 12.493 c 2.311 2.31 6.07 2.311 8.381 0 c 2.31 -2.311 2.31 -6.071 0 -8.381 L 10.794 2.413 l 2.059 -0.846 c 7.766 -3.191 16.616 -1.418 22.549 4.514 c 5.433 5.433 7.39 13.516 5.114 20.831 l 22.572 22.573 c 7.314 -2.278 15.398 -0.32 20.832 5.114 c 5.934 5.933 7.704 14.784 4.514 22.549 l -0.847 2.059 L 75.095 66.714 c -1.113 -1.113 -2.601 -1.726 -4.191 -1.726 s -3.077 0.613 -4.191 1.726 c -2.31 2.311 -2.31 6.071 0 8.381 l 12.493 12.492 l -2.06 0.847 C 74.582 89.487 71.899 89.999 69.243 90 z M 27.692 37.1 l 25.206 25.207 l -0.322 0.887 c -2.345 6.469 -0.728 13.779 4.119 18.626 c 4.538 4.538 11.069 6.235 17.152 4.603 l -9.232 -9.232 c -3.466 -3.467 -3.466 -9.109 0 -12.576 c 3.466 -3.468 9.109 -3.468 12.576 0 l 9.232 9.232 c 1.633 -6.083 -0.064 -12.615 -4.602 -17.153 c -4.847 -4.847 -12.161 -6.464 -18.627 -4.118 l -0.887 0.322 L 37.101 27.692 l 0.322 -0.887 c 2.345 -6.469 0.729 -13.78 -4.118 -18.627 c -4.539 -4.538 -11.07 -6.235 -17.152 -4.603 l 9.232 9.232 c 3.467 3.467 3.467 9.109 0 12.576 s -9.109 3.468 -12.576 0 l -9.233 -9.232 C 1.942 22.234 3.64 28.765 8.178 33.304 c 4.848 4.848 12.16 6.464 18.628 4.118 L 27.692 37.1 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" /></g></svg>',
        click () { window.handler.emit("fixlink") },
    },
    {
        name: "widescreen",
        tipPosition: "s",
        tip: '宽屏模式',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="256" height="256" viewBox="0 0 256 256" xml:space="preserve"><defs></defs><g style="stroke: none; stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: none; fill-rule: nonzero; opacity: 1;" transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)" ><path d="M 69.704 75.086 c -0.5 0 -1.005 -0.098 -1.486 -0.297 c -1.453 -0.603 -2.393 -2.008 -2.393 -3.581 v -4.643 h -31.29 c -1.105 0 -2 -0.896 -2 -2 c 0 -1.105 0.896 -2 2 -2 h 31.414 c 2.138 0 3.876 1.738 3.876 3.875 v 4.467 l 16.126 -16.125 L 69.825 38.658 v 4.467 c 0 2.137 -1.738 3.876 -3.876 3.876 H 47.175 c -1.105 0 -2 -0.896 -2 -2 s 0.896 -2 2 -2 h 18.65 v -4.643 c 0 -1.573 0.939 -2.978 2.392 -3.58 c 1.454 -0.603 3.111 -0.272 4.224 0.839 l 16.427 16.427 c 1.51 1.512 1.51 3.969 0.001 5.48 L 72.441 73.949 C 71.698 74.692 70.711 75.086 69.704 75.086 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" /><path d="M 20.296 55.521 c -1.007 0 -1.994 -0.395 -2.737 -1.138 L 1.133 37.958 c -1.511 -1.511 -1.511 -3.97 0 -5.481 l 16.426 -16.426 c 1.112 -1.112 2.77 -1.441 4.223 -0.84 c 1.453 0.602 2.392 2.007 2.392 3.581 v 4.643 h 31.29 c 1.105 0 2 0.896 2 2 s -0.896 2 -2 2 H 24.05 c -2.137 0 -3.876 -1.738 -3.876 -3.875 v -4.467 L 4.05 35.217 l 16.125 16.125 v -4.467 c 0 -2.137 1.739 -3.875 3.876 -3.875 h 23.125 c 1.105 0 2 0.896 2 2 s -0.896 2 -2 2 h -23 v 4.644 c 0 1.573 -0.939 2.978 -2.393 3.58 C 21.3 55.423 20.795 55.521 20.296 55.521 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" /></g></svg>',
        click: () => { 
            myconfig.showWideScreen = myconfig.showWideScreen ? false : true;
            handler.emit("saveToolbarToConfig", {key: "showWideScreen", value: myconfig.showWideScreen});
            window.handler.emit("init"); // 由于没有提供 API 刷新 padding 暂时以重开实现
        },
    },
];
function getToolbar() {
    return [
        ...group1, "|",
        ...group2, "|",
        ...group3, "|",
        ...group4, "|",
        ...group5, "|",
        {
            // 子菜单
            name: "more",
            toolbar: [
                "both",
                "outdent",
                "indent",
                "insert-before",
                "insert-after",
                // "edit-mode",
                // "export",
                "preview",
                "info",
                "help",
            ],
        },
    ];
}
function getToolbarWide() {
    return [
        ...group1, "|",
        ...group2, "|",
        ...group3, {name: "outdent", tipPosition: "s"}, {name: "indent", tipPosition: "s"},"|",
        ...group4, {name: "insert-before", tipPosition: "s"}, {name: "insert-after", tipPosition: "s"}, {name: "undo", tipPosition: "s"}, {name: "redo", tipPosition: "s"}, "|",
        ...group5, "|",
        {name: "preview", tipPosition: "s"}, {name: "info", tipPosition: "s"}, {name: "help", tipPosition: "s"},
    ];
}
// "[{(' 等符号配对，和自定义快捷键，但会影响打字速度
const keys = ['{', '[', '(', '\'', '"']; // 分别对应 [{ '" 9(
const keyMapping = {'{': '}', '[': ']', '(': ')', '\'' : '\'', '"': '"'};
function isCompose(e) { return e.metaKey || e.ctrlKey; } // 检查是否为组合键
window.addEventListener('keydown', async (e) => {
    if (isCompose(e)) {
        // vditor 不支持 cmd+shift+v 粘贴
        switch (e.code) {
            case 'KeyV':
                if (e.shiftKey) {
                    const text = await navigator.clipboard.readText();
                    if (text) document.execCommand('insertText', false, text.trim());
                    e.stopPropagation();
                }
                else if (document.getSelection()?.toString()) {
                    // 修复剪切后选中文本没有被清除，这里的修改只对网页版的 VSCode 生效
                    document.execCommand("delete");
                    e.preventDefault();
                }
                break;
        }
    }

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
    // 设置 toolbar 上直接显示的按钮的点击事件，带有子菜单的按钮如主题等不会触发
    document.querySelector(".vditor-toolbar").addEventListener('click', e => {
        let target = e.target, type; // e.target 即事件实际触发的元素；声明一个 type 变量，值为 undefined
        for (let i = 0; i < 3; i++) {
            if (type = target.dataset.type) break; // 查找 data-type 的属性，并为 type 赋值，如 data-type="button" 则 type="button"
            target = target.parentElement;
        }
        if (type == 'outline') {
            myconfig.showOutline = options.outline.enable;
            handler.emit("saveToolbarToConfig", {key: "showOutline", value: options.outline.enable});
        }
    });
    // 设置内容主题和代码块主题按钮的点击事件，子菜单按钮只能根据类选择器，这将会匹配都带子菜单的按钮（如代码主题）和更多按钮中的所有选项
    // TODO 故这里其实会导致点击 headings 等按钮也会触发保存配置，更精细的选择需要修改 vditor 源码，为 ContentTheme.ts 等文件中的 button 设置 id 属性
    const subToolbars = document.querySelectorAll(".vditor-hint");
    subToolbars.forEach(subToolbar => {
        subToolbar.addEventListener('click', e => {
            if (e.target.tagName == 'BUTTON') {
                // 无论是不是主题按钮触发的，都保存配置
                myconfig.editorContentTheme = options.preview.theme.current;
                myconfig.codeTheme = options.preview.hljs.style;
                handler.emit("saveToolbarToConfig", {key: "editorContentTheme", value: options.preview.theme.current});
                handler.emit("saveToolbarToConfig", {key: "codeTheme", value: options.preview.hljs.style});
            }
        });
    });
}
// 复原滚动位置
function setScroll(top) {
    document.querySelector(".vditor-reset").addEventListener("scroll", e => {
        handler.emit("scroll", { scrollTop: e.target.scrollTop })
    });
    const scrollHack = setInterval(() => {
        const editorContainer = document.querySelector(".vditor-reset");
        if (!editorContainer) return;
        editorContainer.scrollTo({ top })
        clearInterval(scrollHack)
    }, 10);
}
// 监听页面大小变化，更新 Vditor 高度
window.onresize = () => {
    window.vditor.style.height = `${document.documentElement.clientHeight - padding_height}px`
    // document.getElementById('vditor').style.height = `${document.documentElement.clientHeight - padding_height}px`
    wideMaxWidth = `${document.documentElement.clientWidth * 0.9}`; // 这里就不刷新 padding 此事件触发频率还挺高的
}
