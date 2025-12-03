/*
 * @Author: zdd
 * @Date: 2023-05-30 17:42:04
 * @LastEditors: zdd dongdong@grizzlychina.com
 * @LastEditTime: 2024-01-25 21:25:23
 * @FilePath: extension.ts
 * @Description:
 */
import * as vscode from 'vscode';
import { init, setLastActiveTextEditorId } from './context';
import { imageGenerate } from './commands/image-generate';
import { newGetxCommonDirectory } from './commands/create-common-directory';
import { newGetxGetBuilderPage } from './commands/new-getx-getbuilder-page';
import { newGetxFullPage } from './commands/new-getx-full-page';
import { newGetxStatefulWidgetGetBuilderPage } from './commands/new-getx-stateful-getbuilder-page';
import { routersGenerate } from './commands/routers-generate';
import { genRestapi } from './swagger-generator';
import { commonCommands } from './commands/common';
import { registerCompletion } from './commands/registerCompletion';
import { registerTailwindHoverProvider } from './commands/tailwindHoverProvider';
import { genVgcodeConfig } from './utils';
import npmProvider from './package-link/npm';
import pubProvider from './package-link/pub';

export function activate(context: vscode.ExtensionContext) {
  console.log('恭喜，您的扩展“vg-vscode-extension”已被激活！');
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) {
        const { id } = editor as any;
        setLastActiveTextEditorId(id);
      }
    },
    null,
    context.subscriptions
  );
  init({ extensionContext: context, extensionPath: context.extensionPath });

  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(['javascript', { pattern: '**/package.json' }], npmProvider),
    vscode.languages.registerDocumentLinkProvider(['yaml', { pattern: '**/pubspec.yaml' }], pubProvider),
    vscode.commands.registerCommand('extension.new-getx-routers-generate', routersGenerate),
    vscode.commands.registerCommand('extension.assets-generate', imageGenerate),
    vscode.commands.registerCommand('extension.new-getx-create-directory', newGetxCommonDirectory),
    vscode.commands.registerCommand('extension.new-getx-page', newGetxFullPage),
    vscode.commands.registerCommand('extension.new-getx-getbuilder-page', newGetxGetBuilderPage),
    vscode.commands.registerCommand('extension.new-getx-stateful-getbuilder-page', newGetxStatefulWidgetGetBuilderPage),
    vscode.commands.registerCommand('extension.vgcode-config-init', genVgcodeConfig),
    vscode.commands.registerCommand('extension.swagger-gen', genRestapi)
  );
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -1);
  statusBarItem.command = 'extension.generateCodeByWebview';
  statusBarItem.text = '$(smiley) Vg Code';
  statusBarItem.tooltip = '可视化生成代码';
  statusBarItem.show();

  registerCompletion(context);
  registerTailwindHoverProvider(context);
  commonCommands(context);
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log('您的扩展“vg-vscode-extension”已被释放！');
}
