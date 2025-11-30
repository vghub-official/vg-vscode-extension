/*
 * @Author: zdd
 * @Date: 2023-06-27 22:01:26
 * @LastEditors: Zdd 445305451@qq.com
 * @LastEditTime: 2025-11-30 10:06:41
 * @FilePath: /vg-vscode-extension/webview-react/src/app.tsx
 * @Description: 
 */
// 运行时配置
import { autoFixContext } from 'react-activation';
import jsxDevRuntime from 'react/jsx-dev-runtime';
import jsxRuntime from 'react/jsx-runtime';
import './app.less';
import './dark.less';
import { IGetLocalMaterialsResult, downloadMaterials, getLocalMaterials, getMaterialLocalList } from './common';

autoFixContext(
  [jsxRuntime, 'jsx', 'jsxs', 'jsxDEV'],
  [jsxDevRuntime, 'jsx', 'jsxs', 'jsxDEV'],
);

// 全局初始化数据配置，用于 Layout 用户信息和权限初始化
// 更多信息见文档：https://umijs.org/docs/api/runtime-config#getinitialstate
export async function getInitialState(): Promise<{ name: string, materialLocalKey: string[], localMaterials: { swagger2api: IGetLocalMaterialsResult[], schema2code: IGetLocalMaterialsResult[], blocks: IGetLocalMaterialsResult[], snippets: IGetLocalMaterialsResult[] } }> {
  let data = await getLocalMaterials();
  let materialLocalKey = await getMaterialLocalList();
  if (typeof data === 'string') {
    await downloadMaterials({ type: 'git', url: 'https://github.com/JimmyZDD/vg-materials.git' })
    data = await getLocalMaterials();
  }
  return { name: '@umijs/max', localMaterials: data, materialLocalKey };
}
