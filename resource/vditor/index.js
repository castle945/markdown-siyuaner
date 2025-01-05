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

window.vscodeEvent = getVscodeEvent();

function addCss(css) {
    const style = document.createElement('style');
    style.innerText = css;
    document.documentElement.appendChild(style)
}



window.addThemeCss = function () {
    addCss(`
    *{
        background-color: var(--vscode-editor-background) !important;
        color: var(--vscode-editor-foreground) !important;
    }
    *{
        border-color: var(--vscode-quickInputTitle-background) !important;
    }
    `);
}

function zoomElement(selector, rate = 5) {
    window.onmousewheel = document.onmousewheel = e => {
        if (!e.ctrlKey || e.metaKey) return;
        const eles = document.querySelectorAll(selector);
        for (const ele of eles) {
            const zoom = ele.style.zoom ? parseInt(ele.style.zoom.replace("%", "")) : 100
            if (e.deltaY > 0) {
                ele.style.zoom = `${zoom - rate}%`;
            } else {
                ele.style.zoom = `${zoom + rate}%`;
            }
        }
    };
}

window.addEventListener('keydown', e => {
    if (e.code == 'F12') window.vscodeEvent.emit('developerTool')
    else if ((isCompose(e) && e.code == 'KeyV')) e.preventDefault()  // vscode的bug, hebrew(希伯来语)键盘会粘贴两次
  })

import { openLink, hotKeys, imageParser, autoSymbol, onToolbarClick, createContextMenu, scrollEditor } from "./util.js";

let state;
function loadConfigs() {
  const elem = document.getElementById('configs')
  try {
    state = JSON.parse(elem.getAttribute('data-config'));
    const { platform } = state;
    document.getElementById('vditor').classList.add(platform)
  } catch (error) {
    console.log('loadConfigFail')
  }
  return state;
}
loadConfigs()

handler.on("open", async (md) => {
  const { config, language } = md;
  addAutoTheme(md.rootPath, config.editorTheme)
  handler.on('theme', theme => {
    loadTheme(md.rootPath, theme)
  })
  const editor = new Vditor('vditor', {
    value: md.content,
    _lutePath: md.rootPath + '/lute.min.js',
    cdn: 'https://unpkg.com/vscode-vditor@3.8.19',
    height: document.documentElement.clientHeight,
    outline: {
      enable: config.openOutline,
      position: 'left',
    },
    toolbarConfig: {
      hide: config.hideToolbar
    },
    cache: {
      enable: false,
    },
    mode: 'wysiwyg',
    lang: language == 'zh-cn' ? 'zh_CN' : config.editorLanguage,
    icon: "material",
    tab: '\t',
    preview: {
      theme: {
        path: `${md.rootPath}/css/content-theme`
      },
      markdown: {
        toc: true,
        codeBlockPreview: config.previewCode,
      },
      hljs: {
        style: config.previewCodeHighlight.style,
        lineNumber: config.previewCodeHighlight.showLineNumber
      },
      extPath: md.rootPath,
      math: {
        engine: 'KaTeX',
        "inlineDigit": true
      }
    },
    toolbar: await getToolbar(md.rootPath),
    extPath: md.rootPath,
    input(content) {
      handler.emit("save", content)
    },
    upload: {
      url: '/image',
      accept: 'image/*',
      handler(files) {
        let reader = new FileReader();
        reader.readAsBinaryString(files[0]);
        reader.onloadend = () => {
          handler.emit("img", reader.result)
        };
      }
    },
    hint: {
      emoji: {},
      extend: hotKeys
    }, after() {
      handler.on("update", content => {
        editor.setValue(content);
      })
      openLink()
      onToolbarClick(editor)
    }
  })
  autoSymbol(handler, editor, config);
  createContextMenu(editor)
  imageParser(config.viewAbsoluteLocal)
  scrollEditor(md.scrollTop)
  zoomElement('.vditor-content')
}).emit("init")


function addAutoTheme(rootPath, theme) {
  loadCSS(rootPath, 'base.css')
  loadTheme(rootPath, theme)
}

function loadTheme(rootPath, theme) {
  loadCSS(rootPath, `theme/${theme}.css`)
}

function loadCSS(rootPath, path) {
  const style = document.createElement('link');
  style.rel = "stylesheet";
  style.type = "text/css";
  style.href = `${rootPath}/css/${path}`;
  document.documentElement.appendChild(style)
}


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
    // {
    //     name: "content-theme",
    //     tipPosition: "s",
    // },
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
];
function loadRes(url) { return fetch(url).then(r => r.text()) }
const isMac = navigator.userAgent.includes('Mac OS');
const shortcutTip = isMac ? '⌘ ^ E' : 'Ctrl Alt E';
export async function getToolbar(resPath) {
    return [
        ...group1, "|",
        ...group2, "|",
        {
            tipPosition: 's',
            tip: `Edit In VSCode (${shortcutTip})`,
            className: 'right',
            icon: await loadRes(`${resPath}/icon/vscode.svg`),
            click() {
                handler.emit("editInVSCode", true)
            }
        },
        "|",
        {
            name: 'selectTheme',
            tipPosition: 's', tip: 'Select Theme',
            icon: 'Theme:',
            click() {
                handler.emit("theme")
            }
        },
        {
            tipPosition: 's', tip: 'Select Theme',
            icon: await loadRes(`${resPath}/icon/theme.svg`),
            click() {
                handler.emit("theme")
            }
        },
        "|",
        ...group3, "|",
        ...group4, "|",
        ...group5, "|",
        "undo",
        "redo",
        "|",
        "preview",
        "help",
    ]
}
// "[{(' 等符号配对，和自定义快捷键，但会影响打字速度
const keys = ['{', '[', '(', '\'', '"']; // 分别对应 [{ '" 9(
const keyMapping = {'{': '}', '[': ']', '(': ')', '\'' : '\'', '"': '"'};
function isCompose(e) { return e.metaKey || e.ctrlKey; } // 检查是否为组合键
// 将浏览器端的 document.execCommand 方法重写并赋值为此处 Node 端的 document.execCommand 方法，只有这样剪切才有效
let _exec = document.execCommand.bind(document); // 绑定原 API 使得可以调用原方法
document.execCommand = (cmd, ...args) => {
    if (cmd === 'delete') {
        setTimeout(() => {
            return _exec(cmd, ...args)
        })
    } else {
        return _exec(cmd, ...args)
    }
}
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


