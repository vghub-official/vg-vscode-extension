/* eslint-disable no-underscore-dangle */
import * as path from 'path';
import * as vscode from 'vscode';
import { window } from 'vscode';
import { getExtensionPath, setLastActiveTextEditorId } from '../context';
import { routes } from './routes';
import { invokeCallback, invokeErrorCallback } from './callback';
import util from '../util';

const fs = require('fs');

type WebViewKeys = 'main' | 'createApp' | 'downloadMaterials';

type Tasks = 'addSnippets' | 'openSnippet' | 'route' | 'updateSelectedFolder';

let webviewPanels: {
  key: WebViewKeys;
  panel: vscode.WebviewPanel;
  disposables: vscode.Disposable[];
}[] = [];

const getHtmlForWebview = (webview: vscode.Webview) => {
  const mainScriptPathOnDisk = vscode.Uri.file(path.join(getExtensionPath(), 'webview-dist', 'umi.js'));
  const vendorsScriptPathOnDisk = vscode.Uri.file(path.join(getExtensionPath(), 'webview-dist', 'vendors.js'));
  const mainScriptUri = 'http://localhost:8000/umi.js';
  const vendorsScriptUri = 'http://localhost:8000/vendors.js';
  // const mainScriptUri = webview.asWebviewUri(mainScriptPathOnDisk);
  // const vendorsScriptUri = webview.asWebviewUri(vendorsScriptPathOnDisk);

  return `
    <!DOCTYPE html>
    <html>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no"/>
        <script>
          window.routerBase = "/";
          window.g_path = "/";
          window.vscode = acquireVsCodeApi();
				</script>
        <script src="${vendorsScriptUri}"></script>
			</head>
			<body>
        <div id="root"></div>
        <script src="${mainScriptUri}"></script>
			</body>
		</html>
`;
};

/**
 * 从某个HTML文件读取能被Webview加载的HTML内容
 * @param {*} context 上下文
 * @param {*} templatePath 相对于插件根目录的html文件相对路径
 */
function getWebViewContent(context: vscode.ExtensionContext, panel: vscode.WebviewPanel, templatePath: string) {
  const resourcePath = util.getExtensionFileAbsolutePath(context, templatePath);
  const dirPath = path.dirname(resourcePath);
  let html = fs.readFileSync(resourcePath, 'utf-8');
  // vscode不支持直接加载本地资源，需要替换成其专有路径格式，这里只是简单的将样式和JS的路径替换
  html = html.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m: String, $1: string, $2: string) => {
    if ($2.startsWith('http')) return m;
    const url = panel.webview.asWebviewUri(vscode.Uri.file(path.resolve(dirPath, '.', $2)));
    return $1 + url + '"';
  });
  return html;
}

export const showWebView = (
  context: vscode.ExtensionContext,
  options: {
    key: WebViewKeys;
    title?: string;
    viewColumn?: vscode.ViewColumn;
    task?: { task: Tasks; data?: any }; // webview 打开后执行命令，比如转到指定路由
  }
) => {
  const webview = webviewPanels.find((s) => s.key === options.key);
  if (webview) {
    webview.panel.reveal();
    if (options.task)
      webview.panel.webview.postMessage({
        cmd: 'vscodePushTask',
        task: options.task.task,
        data: options.task.data,
      });
  } else {
    // 创建 webview 的时候，设置之前 focus 的 activeTextEditor
    if (vscode.window.activeTextEditor) setLastActiveTextEditorId((vscode.window.activeTextEditor as any).id);

    const panel = vscode.window.createWebviewPanel(
      'vgcode',
      options.title || 'VG-CODE',
      {
        viewColumn: options.viewColumn || vscode.ViewColumn.Two,
        preserveFocus: true,
      },
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(getExtensionPath(), 'webview-dist'))],
        retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
      }
    );
    // panel.webview.html = getWebViewContent(context, panel, 'webview-dist/index.html');

    panel.webview.html = getHtmlForWebview(panel.webview);
    const disposables: vscode.Disposable[] = [];
    panel.webview.onDidReceiveMessage(
      async (message: { cmd: string; cbid: string; data: any; skipError?: boolean }) => {
        if (routes[message.cmd]) {
          try {
            const res = await routes[message.cmd](message, {
              webview: panel.webview,
              webviewKey: options.key,
              task: options.task,
            });
            invokeCallback(panel.webview, message.cbid, res);
          } catch (ex: any) {
            if (!message.skipError) window.showErrorMessage(ex.toString());

            invokeErrorCallback(panel.webview, message.cbid, ex);
          }
        } else {
          invokeErrorCallback(panel.webview, message.cbid, `未找到名为 ${message.cmd} 回调方法!`);
          vscode.window.showWarningMessage(`未找到名为 ${message.cmd} 回调方法!`);
        }
      },
      null,
      disposables
    );
    panel.onDidDispose(
      () => {
        panel.dispose();
        while (disposables.length) {
          const x = disposables.pop();
          if (x) x.dispose();
        }
        webviewPanels = webviewPanels.filter((s) => s.key !== options.key);
      },
      null,
      disposables
    );
    webviewPanels.push({
      key: options.key,
      panel,
      disposables,
    });
    setTimeout(() => {
      if (options.task)
        panel.webview.postMessage({
          cmd: 'vscodePushTask',
          task: options.task.task,
          data: options.task.data,
        });
    }, 1100);
  }
};
