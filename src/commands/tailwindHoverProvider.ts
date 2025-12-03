/*
 * @Author: zdd
 * @Date: 2025-12-03 15:30:00
 * @LastEditors: Zdd 445305451@qq.com
 * @LastEditTime: 2025-12-03 19:04:47
 * @FilePath: /vg-vscode-extension/src/commands/tailwindHoverProvider.ts
 * @Description: Tailwind CSS 类名 hover 提示提供器
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { compileString } from 'sass';

// 基础的 Tailwind CSS 类映射（简化版）
const tailwindClassMap: Record<string, string> = {
  // Layout - Display
  block: 'display: block;',
  inline: 'display: inline;',
  'inline-block': 'display: inline-block;',
  flex: 'display: flex;',
  'inline-flex': 'display: inline-flex;',
  grid: 'display: grid;',
  hidden: 'display: none;',

  // Layout - Position
  static: 'position: static;',
  fixed: 'position: fixed;',
  absolute: 'position: absolute;',
  relative: 'position: relative;',
  sticky: 'position: sticky;',
};

// 合并所有类映射
const allTailwindClasses = { ...tailwindClassMap };

// 存储自定义 CSS 类的映射
let customCssClasses: Record<string, string> = {};

// 解析自定义 CSS 文件并提取类名
function parseCustomCssFiles() {
  // 获取工作区根路径
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return;

  const rootPath = workspaceFolders[0].uri.fsPath;

  // 获取配置
  const config = vscode.workspace.getConfiguration('vgcode');
  const cssFiles: string[] = config.get('customCssFiles', []);
  console.log('CSS files from config:', cssFiles);
  customCssClasses = {};

  // 解析每个配置的 CSS 文件
  for (const relativePath of cssFiles)
    try {
      const fullPath = path.join(rootPath, relativePath);
      console.log(`CSS Checking file: ${fullPath}`);
      if (fs.existsSync(fullPath)) {
        console.log(`CSS File exists: ${fullPath}`);
        const content = fs.readFileSync(fullPath, 'utf8');
        parseCssContent(content, relativePath);
      } else {
        console.log(`CSS File does not exist: ${fullPath}`);
      }
    } catch (error) {
      console.error(`Error parsing CSS file ${relativePath}:`, error);
    }

  console.log('Custom CSS classes:', customCssClasses);
}

// 解析 CSS 内容并提取类名
function parseCssContent(content: string, filePath: string) {
  // 移除注释
  let contentWithoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  // 如果是 SCSS 文件，需要特殊处理
  if (filePath.endsWith('.scss')) contentWithoutComments = compileString(content).css;

  // 匹配 CSS 类选择器（支持多个类选择器组合）
  const classRegex = /(?:^|[\s\/\*])(\.([\w-]+)(\s*:hover)?)(,\s*(\.([\w-]+)(\s*:hover)?))*\s*\{([^}]*)\}/gm;
  let match;

  while ((match = classRegex.exec(contentWithoutComments)) !== null) {
    // 提取完整的匹配内容
    const fullMatch = match[0];
    const cssContent = match[match.length - 1].trim(); // CSS 内容是最后一个捕获组

    // 提取所有类名
    const classNames = [];
    const selectorText = fullMatch.substring(0, fullMatch.indexOf('{')).trim();
    const selectors = selectorText.split(',');

    for (const selector of selectors) {
      const trimmedSelector = selector.trim();
      // 匹配类名和可能的伪类
      const classMatch = trimmedSelector.match(/\.([\w-]+)(\s*:hover)?/);
      if (classMatch) {
        const className = classMatch[1];
        const pseudoClass = classMatch[2] || '';
        const fullClassName = pseudoClass ? `${pseudoClass.slice(1)}:${className}` : className;
        classNames.push(fullClassName);
      }
    }

    // 为每个类名分配相同的 CSS 内容
    // 如果已经有这个类名，追加内容
    for (const className of classNames)
      if (customCssClasses[className]) customCssClasses[className] += `\n${cssContent}`;
      else customCssClasses[className] = cssContent;
  }
  console.log('Custom CSS classes:', Object.keys(customCssClasses));
}

// 创建 hover provider
export class TailwindHoverProvider implements vscode.HoverProvider {
  constructor() {
    // 初始化时解析自定义 CSS 文件
    setTimeout(() => {
      parseCustomCssFiles();
    }, 1000); // 延迟执行以确保工作区完全加载

    // 监听配置变化
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('vgcode.customCssFiles')) {
        console.log('Configuration changed for vgcode.customCssFiles');
        parseCustomCssFiles();
      }
    });

    // 监听文件变化
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{css,scss,less}', false, false, false);
    watcher.onDidChange(() => {
      console.log('CSS/SCSS/LESS file changed, re-parsing...');
      parseCustomCssFiles();
    });
    watcher.onDidCreate(() => {
      console.log('CSS/SCSS/LESS file created, re-parsing...');
      parseCustomCssFiles();
    });
    watcher.onDidDelete(() => {
      console.log('CSS/SCSS/LESS file deleted, re-parsing...');
      parseCustomCssFiles();
    });
  }

  provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
    // 获取当前单词范围
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return null;

    // 获取当前单词
    const word = document.getText(wordRange);

    // 检查是否为 Tailwind CSS 类
    if (allTailwindClasses[word]) {
      // 创建 hover 内容
      const cssContent = allTailwindClasses[word];
      const markdownString = new vscode.MarkdownString();
      markdownString.appendCodeblock(`/* ${word} */\n{\n  ${cssContent}\n}`, 'css');
      markdownString.isTrusted = true;
      markdownString.supportHtml = true;

      return new vscode.Hover(markdownString, wordRange);
    }

    // 检查是否为自定义 CSS 类
    if (customCssClasses[word]) {
      // 创建 hover 内容
      const cssContent = customCssClasses[word];
      const markdownString = new vscode.MarkdownString();
      markdownString.appendCodeblock(`/* ${word} */\n{\n  ${cssContent}\n}`, 'css');
      markdownString.isTrusted = true;
      markdownString.supportHtml = true;

      return new vscode.Hover(markdownString, wordRange);
    }

    // 处理多个类名的情况 (用空格分隔)
    if (word.includes(':')) {
      // 处理伪类 (如 hover:bg-blue-500)
      const parts = word.split(':');
      if (parts.length === 2) {
        const pseudoClass = parts[0]; // hover, focus, etc.
        const twClass = parts[1]; // bg-blue-500

        if (allTailwindClasses[twClass]) {
          const cssContent = allTailwindClasses[twClass];
          const markdownString = new vscode.MarkdownString();
          markdownString.appendCodeblock(`${pseudoClass}: {\n  /* ${twClass} */\n  ${cssContent}\n}`, 'css');
          markdownString.isTrusted = true;
          markdownString.supportHtml = true;

          return new vscode.Hover(markdownString, wordRange);
        }

        // 检查是否为自定义 CSS 类
        if (customCssClasses[twClass]) {
          const cssContent = customCssClasses[twClass];
          const markdownString = new vscode.MarkdownString();
          markdownString.appendCodeblock(`${pseudoClass}: {\n  /* ${twClass} */\n  ${cssContent}\n}`, 'css');
          markdownString.isTrusted = true;
          markdownString.supportHtml = true;

          return new vscode.Hover(markdownString, wordRange);
        }
      }
    }

    return null;
  }
}

// 注册 hover provider
export function registerTailwindHoverProvider(context: vscode.ExtensionContext) {
  const provider = vscode.languages.registerHoverProvider({ pattern: '**', scheme: 'file' }, new TailwindHoverProvider());

  context.subscriptions.push(provider);
}
