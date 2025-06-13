import { Material, camelCase, compile as compileEjs, existsSync, find, join, writeFile } from '@root/utils';
import { DART_TYPE, INDENT, SwaggerGenTool, getDartDefaultValue, getDartType } from '../../utils';
import { IDescriptionOption, JSONSchema, Method, SwaggerParameter } from '../../index.d';
import { PlatformImplementor } from '.';
import { filter } from 'lodash';

const rootName = 'requests';
// 具体实现角色
export class DartPlatformImplementor implements PlatformImplementor {
  swagger2apiMaterialPath = join(Material.getDirPath('swagger2api'), 'dart');
  fileExtension = 'dart';
  baseTypes = DART_TYPE;
  formDataType = 'FormData';
  getSchameType = getDartType;
  isArrPropType = (propType: string) => propType.startsWith('List');

  public getReqHeader(fileHeader: string, deeps: number, className: string) {
    return `${fileHeader}
import 'model.g.dart';
import '${join(...Array(deeps - 1).fill('..'), 'base_http.dart')}';

class ${className} {\n`;
  }

  private getArrReturnType(resClass?: string, isPagination = false) {
    if (!resClass) return undefined;
    if (resClass.startsWith('List<')) {
      const subType = this.arraySubClass(resClass);
      const [pageName] = SwaggerGenTool.pageResName;
      return isPagination ? `${pageName}<${subType}>` : resClass;
    }
    return resClass;
  }

  public arraySubClass(name: string) {
    return name.startsWith('List<') ? name.substring(5, name.length - 1) : name;
  }

  public getIndexFileContnet(path?: string, modelEmpty?: boolean) {
    if (!path) return `library ${rootName};\n\n`;
    let str = `export '.${path}/request.g.dart';\n`;
    if (!modelEmpty) str += `export '.${path}/model.g.dart';\n`;
    return str;
  }

  public wirtFile(overwrite: boolean, dirPath: string, options: { sharedModelNames: string[]; apiContent: string; modelContent: string; deeps: number }) {
    let { apiContent, modelContent, sharedModelNames, deeps } = options;

    const filterModelNames = filter(
      sharedModelNames,
      (value) => modelContent.includes(`${value} `) || modelContent.includes(`${value}?`) || modelContent.includes(`<${value}>`)
    );
    let shared = '\n\n';
    if (filterModelNames.length > 0) shared += `import '${join(...Array(deeps - 1).fill('..'), 'shared_model.g.dart')}';`;
    if (sharedModelNames.length > 0) shared += `${shared !== '\n\n' ? '\n' : ''}export '${join(...Array(deeps - 1).fill('..'), 'shared_model.g.dart')}';`;
    if (shared !== '\n\n') shared += '\n\n';

    modelContent = SwaggerGenTool.modelHeader + shared + modelContent;

    const modelEmpty = modelContent === SwaggerGenTool.modelHeader + '\n\n';
    if (!overwrite) {
      writeFile(join(dirPath, 'request.g.vg'), apiContent + '}', 'utf-8');
      if (!modelEmpty) writeFile(join(dirPath, 'model.g.vg'), modelContent, 'utf-8');
    }

    if (modelEmpty) apiContent = apiContent.replace(`import 'model.g.dart';\n`, '');
    if (!existsSync(join(dirPath, 'request.g.dart')) || overwrite) writeFile(join(dirPath, 'request.g.dart'), apiContent + '}', 'utf-8');

    if ((!existsSync(join(dirPath, 'model.g.dart')) || overwrite) && !modelEmpty) writeFile(join(dirPath, 'model.g.dart'), modelContent, 'utf-8');
  }

  public pathParam(p: SwaggerParameter) {
    const name = camelCase(p.name);
    const type = getDartType({ param: p, key: name });
    const description = p.description;
    const require = p.required;

    return { name, orgKey: p.name, type, description, require, schema: p.schema };
  }

  public getEnumModelContent(className: string, value: JSONSchema) {
    const type = SwaggerGenTool.implementor.getSchameType({ property: value });
    const enumVals = value.enum;
    const commentNames = value['x-enum-varnames']!.map((key) => value!['x-enum-comments']![key]);
    const varnames = value['x-enum-varnames']!.map((e) => camelCase(e.replace(className, '')));

    const unknowName = 'errorOrUnknow';
    const unknowVal = value!.type === 'integer' ? '-100' : `'error_or_unknow'`;

    let propsContent = enumVals ? `${INDENT}${unknowName}(${unknowVal}),\n` : '';
    let constructorContent = 'switch (val) {\n';

    enumVals?.forEach((e, index) => {
      const comment = commentNames[index];
      const varname = value!.type === 'integer' ? varnames[index] : camelCase(e);
      const eValue = value!.type === 'integer' ? e : `'${e}'`;
      propsContent += `${INDENT}/// ${comment}\n${INDENT}${varname}(${eValue}),\n`;
      constructorContent += `${INDENT}${INDENT}${INDENT}case ${eValue}:\n${INDENT}${INDENT}${INDENT}${INDENT}return ${className}.${varname};\n`;
    });
    if (propsContent.length > 0) propsContent = propsContent.substring(2, propsContent.length - 2) + ';';
    if (constructorContent.length > 0) constructorContent += `${INDENT}${INDENT}}`;

    const template = SwaggerGenTool.getMaterialTemplateWithName('enum_model');

    const modelContent = compileEjs(template, {
      type,
      className,
      propsContent,
      constructorContent,
      commentNames: `[${commentNames.map((e) => `"${e}"`).join(', ')}];`,
    } as any);
    return modelContent;
  }

  getModelContent(className: string, value: JSONSchema) {
    const constructorContent = this.getConstructorContent(value.properties, value.required);
    const properties = this.getPropertiesContent(value.properties, value.required);
    const fromJsonContent = this.getFromJsonContent(value.properties, value.required);
    const toJsonContent = this.getToJsonContent(value.properties, value.required);
    const template = SwaggerGenTool.getMaterialTemplateWithName('model');

    let modelContent = compileEjs(template, {
      className,
      properties,
      constructorContent,
      fromJsonContent,
      toJsonContent,
    } as any);
    const needFormKeys = SwaggerGenTool.needFormKeys(className);
    if (needFormKeys) {
      const rowKeysContent = this.getRowKeysContent(value.properties);
      modelContent = `class ${className}RowKeys {\n${rowKeysContent}}\n\n${modelContent}`;
    }

    return modelContent;
  }

  public getDescription(options: IDescriptionOption) {
    const { summary, description, operationId } = options;
    let desc = summary ? `\n${INDENT}/// ${summary}` : '';
    desc += description ? `\n${INDENT}/// @description ${description}` : '';
    desc += operationId ? `\n${INDENT}/// @operationId ${operationId}` : '';
    const { returnType, paths, querys, formData, body } = options;
    if (paths.length > 0 || querys.length > 0 || formData || body) desc += `\n${INDENT}///\n${INDENT}/// parameters`;

    const replaceLineBreak = (str: string) => str.replaceAll(/\n/g, `\n${INDENT}/// `);

    paths.forEach(({ type, require, name, description }) => {
      desc += `\n${INDENT}/// @pathParam [${type}${require ? '' : '?'}] ${name}${description ? `: ${replaceLineBreak(description)}` : ''}`;
    });

    querys.forEach(({ type, require, name, description }) => {
      desc += `\n${INDENT}/// @queryParam [${type}${require ? '' : '?'}] ${name}${description ? `: ${replaceLineBreak(description)}` : ''}`;
    });

    if (formData) {
      const { type, name, description } = formData;
      desc += `\n${INDENT}/// @formDataParam [${type}] ${name}${description ? `: ${replaceLineBreak(description)}` : ''}`;
    }
    if (body) {
      const { type, name, description } = body;
      desc += `\n${INDENT}/// @bodyParam [${type}] ${name}${description ? `: ${replaceLineBreak(description)}` : ''}`;
    }

    desc += `\n${INDENT}/// @return [${returnType}]`;

    return desc;
  }

  public getFunctionArgs(options: Pick<IDescriptionOption, 'formData' | 'body' | 'paths' | 'querys'>) {
    const { paths, querys, formData, body } = options;
    let str = '';
    paths.forEach((p) => {
      str += `${p.type} ${p.name}, `;
    });
    if (querys.length > 0) str += '{\n';
    querys.forEach((p) => {
      const type = p.type.replace(/(int|num|double|bool)/, 'String');
      str += `${INDENT}${INDENT}${p.require ? 'required ' : ''}${type}${p.require ? '' : '?'} ${p.name},\n`;
    });
    if (formData) {
      if (!str.includes('{')) str += '{\n';
      str += `${INDENT}${INDENT}required ${formData.type} ${formData.name},\n`;
    }
    if (body) {
      if (!str.includes('{')) str += '{\n';
      str += `${INDENT}${INDENT}required ${body.type} ${body.name},\n`;
    }

    if (str.includes('{')) {
      if (str.endsWith(',\n')) str = str.substring(0, str.length - 2);
      str += `${INDENT}}`;
    } else {
      if (str.endsWith(', ')) str = str.substring(0, str.length - 2);
    }
    return str;
  }

  getSimpleReturnType(responses: JSONSchema | undefined, name: string) {
    if (!responses) return 'dynamic';

    let resClass: string;
    let [standardRes] = SwaggerGenTool.getStandardResponse(responses);
    if (standardRes) {
      if (standardRes['anyOf']) standardRes = find(standardRes['anyOf'], (item) => item.type !== 'null');
      resClass = standardRes ? getDartType({ property: standardRes, key: name }) : 'dynamic';
    } else {
      resClass = 'dynamic';
    }
    return this.arraySubClass(resClass);
  }

  getReturnType(responses: JSONSchema | undefined, resClassName: string) {
    if (!responses) return 'dynamic';
    let resClass: string | undefined;
    let [standardRes, isPagination] = SwaggerGenTool.getStandardResponse(responses);
    if (standardRes) {
      if (standardRes['anyOf']) standardRes = find(standardRes['anyOf'], (item: JSONSchema) => item.type !== 'null');
      resClass = standardRes ? getDartType({ property: standardRes, key: resClassName }) : undefined;
    } else {
      resClass = 'dynamic';
    }
    if (resClass === 'null') return 'void';
    resClass = this.getArrReturnType(resClass, isPagination);
    return resClass !== undefined ? `${resClass}` : 'void';
  }

  getReqArgs(key: string, method: Method, options: Pick<IDescriptionOption, 'formData' | 'body' | 'paths' | 'querys'>) {
    const { paths, querys, formData, body } = options;
    const { urlPrefix } = SwaggerGenTool.config;
    const path = (urlPrefix ?? '') + key;
    if (!formData && !body && paths.length === 0 && querys.length === 0) return `'${path}'${['put', 'post'].includes(method) ? ', null' : ''}`;

    let str = '',
      reqPath = path,
      queryStr = '';

    paths.forEach(({ name }) => {
      if (reqPath.includes(`{${name}}`)) reqPath = reqPath.replace(`{${name}}`, `\$${name}`);
      else reqPath += reqPath.endsWith('/') ? `\$${name}` : `/\$${name}`;
    });
    str += `'${reqPath}'`;

    if (body && ['put', 'post'].includes(method)) {
      const { type } = body;
      const value = SwaggerGenTool.dataModels[type] ?? body.schema;
      var suffix = '';
      if (type && !DART_TYPE.includes(this.arraySubClass(type)) && SwaggerGenTool.isEnumObject(value)) suffix = `.value`;
      else if (type && !DART_TYPE.includes(this.arraySubClass(type))) suffix = `.toJson()`;
      else if (type && ['int', 'double'].includes(type)) suffix = `.toString()`;
      str += `, body${suffix}`;
    } else if (!body && ['put', 'post'].includes(method) && !formData) {
      str += `, null`;
    }
    if (formData && !str.includes(', body') && ['put', 'post'].includes(method)) str += ', body';

    if (querys.length > 0) {
      queryStr += '{';
      querys.forEach(({ type, name, orgKey, require, schema }) => {
        var suffix = '';
        const value = SwaggerGenTool.dataModels[type] ?? schema;
        if (type && !DART_TYPE.includes(this.arraySubClass(type)) && SwaggerGenTool.isEnumObject(value)) suffix = `.value`;
        else if (type && !DART_TYPE.includes(this.arraySubClass(type))) suffix = `.toJson()`;
        // else if (type && ['int', 'double'].includes(type)) suffix = `.toString()`;
        queryStr += `\'${orgKey}\': ${name}${require || !suffix ? '' : '?'}${suffix}, `;
      });
      queryStr = queryStr.substring(0, queryStr.length - 2);
      queryStr += '}';
    }
    if (queryStr.length !== 0) str += `, query: ${queryStr}`;
    if (!str.includes(',') && ['put', 'post'].includes(method)) str += ', null';
    return str;
  }

  getReturnContent(responses: JSONSchema | undefined, resClassName: string) {
    const returnType = this.getReturnType(responses, resClassName);
    if (returnType === 'void') return '';
    const resName = SwaggerGenTool.resName;
    const [pageName, keyName] = SwaggerGenTool.pageResName;
    const [standardRes] = SwaggerGenTool.getStandardResponse(responses);
    if (!standardRes) return `\n${INDENT}${INDENT}return ${resName};`;

    let type = returnType;
    if (DART_TYPE.includes(type) || type === 'List<Map<String, dynamic>>') {
      const safeRes = `\n${INDENT}${INDENT}if (res.body is! Map || res.body['data'] is! ${type}) return ${getDartDefaultValue(type)};`;
      return `${safeRes}\n${INDENT}${INDENT}return ${resName};`;
    } else if (type.startsWith('List<')) {
      const subType = type.substring(5, type.length - 1);
      const value = SwaggerGenTool.dataModels[subType] ?? standardRes;
      const suffix = SwaggerGenTool.isEnumObject(value) ? 'from(e)' : 'fromJson(e)';
      return `\n${INDENT}${INDENT}return ${resName} == null ? [] : ${type}.from(${resName}.map((e) => ${subType}.${suffix}));`;
    } else if (type.startsWith(pageName)) {
      const subType = type.substring(pageName.length + 1, type.length - 1);
      const value = SwaggerGenTool.dataModels[subType] ?? standardRes;
      const suffix = SwaggerGenTool.isEnumObject(value) ? 'from(e)' : 'fromJson(e)';
      if (SwaggerGenTool.requestScript?.getPagingReturnContent) return SwaggerGenTool.requestScript?.getPagingReturnContent(subType, suffix);

      return `\n${INDENT}${INDENT}var pageData = ${resName};
    List<${subType}> ${keyName} = pageData == null
        ? []
        : List<${subType}>.from(
            pageData.map((e) => ${subType}.${suffix}));
    return ${pageName}(
      ${keyName},${SwaggerGenTool.pageResProps.map((key: string) => `\n${INDENT}${INDENT}${INDENT}${key}: res.body['${key}']`).join(',')},
    );`;
    } else {
      const value = SwaggerGenTool.dataModels[type] ?? standardRes;
      const suffix = SwaggerGenTool.isEnumObject(value) ? `from(${resName})` : `fromJson(${resName})`;
      return `\n${INDENT}${INDENT}return ${type}.${suffix};`;
    }
  }

  /// model
  private getConstructorContent(properties: JSONSchema['properties'], required: (string | number)[] | undefined) {
    let str = '{\n';
    for (const propertyName in properties) {
      const property = properties[propertyName];
      const dartType = getDartType({ key: propertyName, property });

      let require = required?.includes(propertyName) ?? false;
      // nullable swagger 3+
      const nullable = Array.isArray(property.type) && find(property.type, (e) => e.toString().includes('null'));
      if (nullable && require && !dartType.startsWith('List')) require = false;

      const camelPropertyName = camelCase(propertyName);
      str += `${INDENT}${INDENT}${require ? 'required ' : ''}this.${camelPropertyName},\n`;
    }
    str += `${INDENT}}`;
    if (str === `{\n${INDENT}}`) str = '';
    return str;
  }

  private getPropertiesContent(properties: JSONSchema['properties'], required: (string | number)[] | undefined) {
    let str = '';
    for (const propertyName in properties) {
      const property = properties[propertyName];
      const dartType = getDartType({ key: propertyName, property });
      const camelPropertyName = camelCase(propertyName);

      let require = required?.includes(propertyName) ?? false;
      // nullable swagger 3+
      const nullable = Array.isArray(property.type) && find(property.type, (e) => e.toString().includes('null'));
      if (nullable && require && !dartType.startsWith('List')) require = false;

      const description = property.title || property.description;
      if (description) str += `${INDENT}/// ${description.replaceAll('\n', `\n${INDENT}/// `)}\n`;
      str += `${INDENT}${dartType}${require || dartType === 'dynamic' ? '' : '?'} ${camelPropertyName};\n\n`;
    }
    str = str.length > 0 ? str.substring(2, str.length - 1) : str;
    return str;
  }

  private getRowKeysContent(properties: JSONSchema['properties']) {
    let str = '';
    for (const propertyName in properties) {
      const property = properties[propertyName];
      const camelPropertyName = camelCase(propertyName);
      const description = property.title || property.description;
      if (description) str += `${INDENT}/// ${description.replaceAll('\n', `\n${INDENT}/// `)}\n`;
      str += `${INDENT}static const ${camelPropertyName} = '${propertyName}';\n\n`;
    }
    str = str.length > 0 ? str.substring(0, str.length - 1) : str;
    return str;
  }

  private getFromJsonContent(properties: JSONSchema['properties'], required: (string | number)[] | undefined) {
    let str = '';
    for (const propertyName in properties) {
      const property = properties[propertyName];
      let dartType = getDartType({ key: propertyName, property });
      const camelPropertyName = camelCase(propertyName);
      const isEnumObject = SwaggerGenTool.isEnumObject(property);

      let require = required?.includes(propertyName) ?? false;
      // nullable swagger 3+
      const nullable = Array.isArray(property.type) && find(property.type, (e) => e.toString().includes('null'));
      if (nullable && require && !dartType.startsWith('List')) require = false;

      str += `${INDENT}${INDENT}${camelPropertyName}: `;
      if (dartType.startsWith('List')) {
        var subType = dartType === 'List' ? '' : dartType.substring(5, dartType.length - 1);
        str += `json["${propertyName}"] is List ? List${subType ? `<${subType}>` : ''}.from(json["${propertyName}"].map((e) => ${
          DART_TYPE.includes(subType) || !subType ? 'e' : `${subType}.fromJson(e)`
        })) : [],\n`;
      } else if (!DART_TYPE.includes(dartType)) {
        const suffix = isEnumObject ? `from(json["${propertyName}"])` : `fromJson(json["${propertyName}"])`;
        str += require ? `${dartType}.${suffix},\n` : `json["${propertyName}"] != null ? ${dartType}.${suffix} : null,\n`;
      } else if (dartType === 'int') {
        str += require ? `int.parse(json["${propertyName}"].toString()),\n` : `int.tryParse(json["${propertyName}"].toString()),\n`;
      } else if (dartType === 'num') {
        str += require ? `num.parse(json["${propertyName}"].toString()),\n` : `num.tryParse(json["${propertyName}"].toString()),\n`;
      } else {
        str += `json["${propertyName}"],\n`;
      }
    }
    str = str.length > 0 ? str.substring(4, str.length - 1) : str;
    return str;
  }

  private getToJsonContent(properties: JSONSchema['properties'], required: (string | number)[] | undefined) {
    let str = '';
    for (const propertyName in properties) {
      const camelPropertyName = camelCase(propertyName);
      const property = properties[propertyName];
      const dartType = getDartType({ key: propertyName, property });
      const isEnumObject = SwaggerGenTool.isEnumObject(property);
      const suffix = isEnumObject ? 'value' : 'toJson()';
      let require = required?.includes(propertyName) ?? false;
      // nullable swagger 3+
      const nullable = Array.isArray(property.type) && find(property.type, (e) => e.toString().includes('null'));
      if (nullable && require && !dartType.startsWith('List')) require = false;

      str += `${INDENT}${INDENT}"${propertyName}": `;

      if (dartType.startsWith('List')) {
        var subType = dartType === 'List' ? '' : dartType.substring(5, dartType.length - 1);
        var simple = DART_TYPE.includes(subType) || !subType;
        str += `${camelPropertyName}${require ? '' : '?'}.map((e) => ${simple ? 'e' : `e.${suffix}`}).toList(),\n`;
      } else if (!DART_TYPE.includes(dartType)) {
        str += `${camelPropertyName}${require ? '' : '?'}.${suffix},\n`;
      } else {
        str += `${camelPropertyName},\n`;
      }
    }
    str = str.length > 0 ? str.substring(4, str.length - 1) : str;
    return str;
  }
}
