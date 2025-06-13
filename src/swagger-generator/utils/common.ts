/*
 * @Author: zdd
 * @Date: 2023-06-01 16:59:31
 * @LastEditors: zdd jimmyzhao163@163.com
 * @LastEditTime: 2025-06-12 17:55:06
 * @FilePath: common.ts
 * @Description:
 */
import { upperFirst, words } from 'lodash';
import { JSONSchema, SwaggerHttpEndpoint, SwaggerParameter } from '../index.d';
import SwaggerGenTool from './gen_tool';
import { exchangeZhToEn } from './helper';
import { first, join, snakeCase, pascalCase, camelCase } from '@root/utils';

/** tab 空格数 */
export const INDENT = '  ';
export const LIST_KEY = 'items';

export const DART_TYPE = ['String', 'int', 'double', 'bool', 'num', 'DateTime', 'dynamic', 'null', 'FormData', 'Map<String, dynamic>', 'List'];
export const TS_TYPE = ['string', 'number', 'boolean', 'null', 'undefined', 'File', 'Record<string, any>', 'any', 'any[]'];

export const METHOD_MAP = {
  get: 'get',
  post: 'create',
  put: 'update',
  delete: 'delete',
};
export interface TypeParam {
  key?: string;
  property?: JSONSchema;
  param?: SwaggerParameter;
}

export function getDartDefaultValue(type: string) {
  switch (type) {
    case 'int':
    case 'double':
    case 'num':
      return 0;
    case 'String':
      return "''";
    case 'bool':
      return 'false';
    case 'DateTime':
      return `DateTime.now()`;
    case 'null':
      return 'null';
    case 'dynamic':
      return 'null';
    case 'List':
      return '[]';
    case 'Map<String, dynamic>':
      return '{}';
    default:
      return '';
  }
}

export function getClassName(name: string, isReq = true) {
  return pascalCase(name.replace(/^(v1|v2|v3|\d+)/, '') + (isReq ? '_req' : '_res'));
}

export function filterPathName(strs: string[]) {
  let res: string = '';
  for (let i = strs.length - 1; i >= 0; i--) {
    if (res.includes(camelCase(strs[i]))) continue;
    res = camelCase(strs[i]) + '_' + res;
  }

  return pascalCase(res);
}

function getRef({ property, param }: TypeParam) {
  let ref: string | undefined = '';
  if (property && property['$ref']) ref = property['$ref'];
  if (param && param.schema && Object.prototype.hasOwnProperty.call(param.schema, '$ref')) ref = (param.schema as JSONSchema)['$ref'];

  if (ref) {
    const parts = ref.split('/');
    const typeName = parts[parts.length - 1];
    return getModelName(typeName);
  }
  return undefined;
}

function calcTypeParam({ key, property, param }: TypeParam) {
  function getCuncrrentType(type: JSONSchema['type']) {
    if (Array.isArray(type)) {
      console.log(type);
      console.log({ key, property, param });
    }
    if (!type) return undefined;
    // TODO: 暂定 type 数组，类型超过 2 个为 any 类型
    const mulitType = Array.isArray(type) ? type?.length > 2 : false;
    if (mulitType) return 'any';
    return Array.isArray(type) ? first(type) : type;
  }

  let type: string | undefined;
  let subClass: string | undefined;

  if (property) {
    //TODO: allOf property 获取第一项
    if (property.allOf) property = property.allOf[0];
    const hasSubProperty = Object.keys(property?.properties ?? {}).length !== 0;
    subClass = key && hasSubProperty ? pascalCase(key) : undefined;
    type = getCuncrrentType(property.type);
  } else if (param) {
    const schema = param.schema;
    property = schema;
    if (param.type) type = getCuncrrentType(param.type);
    else if (!schema) type = '';
    else type = typeof schema === 'string' ? schema : getCuncrrentType(schema.type);
    const hasSubProperty = Object.keys(property?.properties ?? {}).length !== 0;
    subClass = key && hasSubProperty ? pascalCase(key) : undefined;
  }
  return { type, property, subClass };
}

export function getTsType({ key, property, param }: TypeParam): string {
  if (key === 'diff_data') {
    console.log({ key });
    console.log({ key });
  }
  const { type, property: _property, subClass } = calcTypeParam({ key, property, param });

  property = _property;
  switch (type) {
    case 'integer':
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'file':
      return 'File';
    case 'object':
      if (!subClass) return 'Record<string, any>';
      return subClass;
    case 'any':
      return 'any';
    case 'array':
      if (!property) return 'any[]';
      const items = property!['items'];
      if (!items || items.type === 'array') return 'any[]';
      let item = items;
      //TODO: 目前仅支持单一类型
      if (Array.isArray(items) && items.length > 0) item = items[0];
      var itemType = getTsType({ key: key, property: item as JSONSchema });
      return `${itemType}[]`;
    default:
      const ref = getRef({ param, property });
      if (ref) return ref;
  }

  return 'any';
}

export function getDartType({ key, property, param }: TypeParam): string {
  const { type, property: _property, subClass } = calcTypeParam({ key, property, param });
  property = _property;

  switch (type) {
    case 'integer':
      return 'int';
    case 'number':
      return 'num';
    case 'string':
      return 'String';
    case 'boolean':
      return 'bool';
    case 'null':
      return 'null';
    case 'file':
      return 'File';
    case 'object':
      if (!subClass) return 'Map<String, dynamic>';
      return subClass;
    case 'any':
      return 'dynamic';
    case 'array':
      const items = property!['items'];
      if (!items || items.type === 'array') return 'List';
      let item = items;
      /// 目前仅支持单一类型
      if (Array.isArray(items) && items.length > 0) item = items[0];
      var itemType = getDartType({ key: key, property: item as JSONSchema });
      return `List<${itemType}>`;
    default:
      const ref = getRef({ param, property });
      if (ref) return ref;
  }

  return 'dynamic';
}

export const getDirPath = (folder: string | undefined) => {
  let dirPath: string,
    deeps = 1,
    className: string;
  const translationObj = SwaggerGenTool.translationObj;
  const targetDir = SwaggerGenTool.targetDirectory;
  if (folder) {
    const { str: path } = exchangeZhToEn(folder, translationObj);
    dirPath = join(
      targetDir,
      path
        .split('/')
        .map((e) => snakeCase(e))
        .join('/')
    );
    deeps += path.split('/').length;
    className = pascalCase(
      path
        .split('/')
        .map((e) => snakeCase(e))
        .join('_') + '_request'
    );
  } else {
    dirPath = join(targetDir);
    className = pascalCase('request');
  }

  return {
    className,
    dirPath,
    deeps,
  };
};

export function getParamObj(parameters: SwaggerHttpEndpoint['parameters']) {
  if (!parameters) return undefined;
  const pathParams = parameters.filter((p) => p['in'] === 'path');
  const queryParams = parameters.filter((p) => p['in'] === 'query');
  const formDataParams = parameters.filter((p) => p['in'] === 'formData');
  const bodyParams = parameters.filter((p) => p['in'] === 'body');

  return {
    pathParams,
    queryParams,
    formDataParams,
    bodyParams,
  };
}

export function getResSchema(schema: JSONSchema) {
  let _val = (schema as JSONSchema).properties?.data;
  if (_val && _val.type === 'array') _val = _val.items;
  return _val;
}

export function getModelName(inputStr: string) {
  const schemasPackageMap = SwaggerGenTool.config.schemasPackageMap ?? {};

  // 1. 查找最长匹配前缀
  const matchedPrefix = findLongestMatchingPrefix(inputStr, Object.keys(schemasPackageMap));
  if (!matchedPrefix && !inputStr.includes('.')) return upperFirst(camelCase(inputStr));

  // 2. 应用映射并处理剩余部分
  const remainingPart = matchedPrefix ? inputStr.replace(matchedPrefix, schemasPackageMap[matchedPrefix] ?? '') : inputStr;

  // 3. 处理无层级结构的简单情况
  if (!remainingPart.includes('.')) {
    return upperFirst(camelCase(remainingPart));
  }

  // 4. 处理层级结构（目前只考虑一个点）
  const [partB, partA] = remainingPart.split('.').reverse(); // 反转以便处理最后一段
  // const partA = parts.slice(0, -1).join('.'); // 获取最后一段前的所有部分
  // const partB = parts[parts.length - 1]; // 获取最后一段
  if (inputStr.includes('gps_entity')) {
    console.log(inputStr);
  }
  // 5. 转换为单词数组
  const partAWords = words(upperFirst(camelCase(partA)));
  const partBWords = words(upperFirst(camelCase(partB)));
  if (!partAWords.length) return partBWords.join('');
  if (!partBWords.length) return partAWords.join('');

  // 6. 查找并合并重叠部分
  const overlapIndex = findOverlapIndex(partAWords, partBWords);
  return mergeWordArrays(partAWords, partBWords, overlapIndex);
}

// 辅助函数：查找最长匹配前缀
function findLongestMatchingPrefix(input: string, prefixes: string[]) {
  // 按长度降序排序以确保优先匹配最长前缀
  const sortedPrefixes = [...prefixes].sort((a, b) => b.length - a.length);
  return sortedPrefixes.find((prefix) => input.startsWith(prefix)) || null;
}

// 辅助函数：查找单词数组重叠位置
function findOverlapIndex(wordsA: string[], wordsB: string[]) {
  const maxPossibleOverlap = Math.min(wordsA.length, wordsB.length);

  // 从最大可能重叠开始向下搜索
  for (let overlap = maxPossibleOverlap; overlap > 0; overlap--) {
    const suffixOfA = wordsA.slice(-overlap).join('');
    const prefixOfB = wordsB.slice(0, overlap).join('');
    if (suffixOfA === prefixOfB) return overlap;
  }
  return 0; // 无重叠
}

// 辅助函数：合并两个单词数组
function mergeWordArrays(wordsA: string[], wordsB: string[], overlap: number) {
  const words = [...wordsA, ...wordsB.slice(overlap)];
  return words.filter((item, index) => index === 0 || item !== words[index - 1]).join('');
}
