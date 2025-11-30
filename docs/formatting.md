# 代码自动格式化指南

## 功能说明

本项目已配置代码保存时自动格式化功能，当您在 VS Code 中保存文件时，代码将自动按照项目规范进行格式化。

## 配置详情

### VS Code 设置

项目已在 `.vscode/settings.json` 中配置了以下设置：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

### 推荐扩展

项目推荐安装以下 VS Code 扩展以获得最佳体验：

1. **Prettier - Code formatter** (`esbenp.prettier-vscode`) - 代码格式化工具
2. **ESLint** (`dbaeumer.vscode-eslint`) - 代码质量检查工具

## 使用方法

### 自动格式化（推荐）

1. 在 VS Code 中打开项目
2. 确保已安装推荐的扩展
3. 编辑代码文件
4. 保存文件 (Ctrl+S 或 Cmd+S)
5. 代码将自动格式化

### 手动格式化

#### 格式化整个项目

```bash
# 格式化 src 目录下的所有文件
pnpm run format

# 检查格式但不修改文件
pnpm run format:check
```

#### 格式化特定文件

在 VS Code 中，您可以：

1. 右键点击文件内容
2. 选择 "Format Document" 或使用快捷键 Shift+Alt+F

## 配置文件

### Prettier 配置

- 根目录: [.prettierrc.js](../.prettierrc.js)
- Webview 目录: [webview-react/.prettierrc](../webview-react/.prettierrc)

### ESLint 配置

- 根目录: [.eslintrc.json](../.eslintrc.json)

## 故障排除

### 格式化未生效

1. 检查是否安装了推荐的扩展
2. 确认 VS Code 右下角显示的格式化程序是否为 Prettier
3. 检查文件类型是否支持格式化（.js, .ts, .jsx, .tsx 等）
4. 重启 VS Code

### 格式不符合预期

1. 检查项目中的 Prettier 配置文件
2. 如果需要调整，请修改 [.prettierrc.js](../.prettierrc.js) 文件
3. 注意不同目录可能有不同的配置

## CI/CD 集成

在持续集成流程中，可以使用以下命令检查代码格式：

```bash
# 检查根目录代码格式
pnpm run format:check

# 检查webview-react目录代码格式
cd webview-react && pnpm run format:check
```

如果格式检查失败，CI/CD 流程将中断，确保所有提交的代码都符合规范。
