import { Material, camelCase, compile as compileEjs, existsSync, find, join, writeFile } from '@root/utils';
import { INDENT, LIST_KEY, SwaggerGenTool, TS_TYPE, getTsType } from '../../utils';
import { IDescriptionOption, JSONSchema, Method, SwaggerParameter } from '../../index.d';
import { PlatformImplementor } from '.';
import { filter } from 'lodash';

export class TsPlatformImplementor implements PlatformImplementor {
  swagger2apiMaterialPath = join(Material.getDirPath('swagger2api'), 'ts');
  fileExtension = 'ts';
  baseTypes = TS_TYPE;
  formDataType = 'FormData';
  getSchameType = getTsType;
  isArrPropType = (propType: string) => propType.endsWith('[]');

  public getReqHeader(fileHeader: string, deeps: number) {
    return `${fileHeader}
import * as models from './model.g';
import { http } from '${join(...Array(deeps - 1).fill('..'), 'base_http')}';\n`;
  }

  private getArrReturnType(resClass?: string, isPagination = false) {
    if (!resClass) return undefined;
    if (resClass.endsWith('[]')) {
      const subType = resClass.substring(0, resClass.length - 2);
      const type = TS_TYPE.includes(subType) ? `${subType}` : `models.${subType}`;
      const [pageName] = SwaggerGenTool.pageResName;
      return isPagination ? `${pageName}<${type}>` : `${type}[]`;
    }

    return (resClass = TS_TYPE.includes(resClass) ? resClass : `models.${resClass}`);
  }

  public arraySubClass(name: string) {
    return name.endsWith('[]') ? name.substring(0, name.length - 2) : name;
  }

  public getIndexFileContnet(path?: string, modelEmpty?: boolean) {
    if (!path) return '';
    let str = `export * from '.${path}/request.g';\n`;
    if (!modelEmpty) str += `export * from '.${path}/model.g';\n`;
    return str;
  }

  public wirtFile(overwrite: boolean, dirPath: string, options: { sharedModelNames: string[]; apiContent: string; modelContent: string; deeps: number }) {
    const [pageName] = SwaggerGenTool.pageResName;
    let { apiContent, modelContent, sharedModelNames, deeps } = options;

    const filterModelNames = filter(sharedModelNames, (value) => modelContent.includes(`: ${value};`) || modelContent.includes(`: ${value}[]`));
    let shared = '\n';
    if (filterModelNames.length > 0) shared += `import { ${filterModelNames.join(', ')} } from '${join(...Array(deeps - 1).fill('..'), 'shared_model.g')}';`;
    if (sharedModelNames.length > 0)
      shared += `${shared !== '\n\n' ? '\n' : ''}export { ${sharedModelNames.join(', ')} } from '${join(...Array(deeps - 1).fill('..'), 'shared_model.g')}';`;
    shared += shared !== '\n' ? '\n\n' : '\n';

    modelContent = SwaggerGenTool.modelHeader + shared + modelContent;

    const modelEmpty = modelContent === SwaggerGenTool.modelHeader + '\n\n';
    if (modelEmpty) apiContent = apiContent.replace(`import * as models from './model.g';\n`, '');

    if (!overwrite) {
      writeFile(join(dirPath, 'request.g.vg'), apiContent, 'utf-8');
      if (!modelEmpty) writeFile(join(dirPath, 'model.g.vg'), modelContent, 'utf-8');
    }

    if (apiContent.includes(`${pageName}<`)) apiContent = apiContent.replace('import { http } from ', `import { http, ${pageName} } from `);
    if (!existsSync(join(dirPath, 'request.g.ts')) || overwrite) writeFile(join(dirPath, 'request.g.ts'), apiContent, 'utf-8');

    if ((!existsSync(join(dirPath, 'model.g.ts')) || overwrite) && !modelEmpty) writeFile(join(dirPath, 'model.g.ts'), modelContent, 'utf-8');
  }

  public pathParam(p: SwaggerParameter) {
    const name = camelCase(p.name);
    let type = getTsType({ param: p });
    if (type?.endsWith('[]')) {
      const subType = type.substring(0, type.length - 2);
      type = TS_TYPE.includes(subType) ? type : `models.${subType}[]`;
    } else {
      type = TS_TYPE.includes(type!) ? type : `models.${type}`;
    }
    const description = p.description;
    const require = p.required;

    return { name, orgKey: p.name, type, description, require, schema: p.schema };
  }

  public getEnumModelContent(className: string, value: JSONSchema) {
    const enumVals = value.enum;
    const commentNames = value['x-enum-varnames']!.map((key) => value!['x-enum-comments']![key]);
    const varnames = value['x-enum-varnames']!.map((e) => camelCase(e.replace(className, '')));
    let propsContent = '';
    let optionsContent = '';

    enumVals?.forEach((e, index) => {
      const comment = commentNames[index];
      const varname = value!.type === 'integer' ? varnames[index] : camelCase(e);
      const eValue = value!.type === 'integer' ? e : `'${e}'`;

      propsContent += `${INDENT}/** ${comment} */\n${INDENT}${varname} = ${eValue},\n`;
      optionsContent += `${INDENT}${INDENT}{ label: "${comment}", value: ${eValue} },\n`;
    });
    if (propsContent.length > 0) propsContent = propsContent.substring(0, propsContent.length - 1);

    const template = SwaggerGenTool.getMaterialTemplateWithName('enum_model');

    const modelContent = compileEjs(template, {
      className,
      propsContent,
      optionsContent,
    } as any);
    return modelContent;
  }

  public getModelContent(className: string, value: JSONSchema) {
    const constructorContent = this.getConstructorContent(value.properties, value.required);
    const properties = this.getPropertiesContent(value.properties, value.required);
    const fromJsonContent = this.getFromJsonContent(value.properties, value.required);
    const toJsonContent = this.getToJsonContent(value.properties, value.required);
    const template = SwaggerGenTool.getMaterialTemplateWithName('model');

    const modelContent = compileEjs(template, {
      className,
      properties,
      constructorContent,
      fromJsonContent,
      toJsonContent,
    } as any);
    return modelContent;
  }

  public getDescription(options: IDescriptionOption) {
    const { summary, description, operationId } = options;
    let desc = `\n/**`;
    desc += summary ? `\n * ${summary}` : '';
    desc += description ? `\n * @description ${description}` : '';
    desc += operationId ? `\n * @operationId ${operationId}` : '';
    const { returnType, paths, querys, formData, body } = options;
    if (paths.length > 0 || querys.length > 0 || formData || body) desc += `\n *\n * parameters`;

    const replaceLineBreak = (str: string) => str.replaceAll(/\n/g, `\n * `);

    paths.forEach(({ type, require, name, description }) => {
      desc += `\n * @pathParam {${type}${require ? '' : '?'}} ${name}${description ? `: ${replaceLineBreak(description)}` : ''}`;
    });

    querys.forEach(({ type, require, name, description }) => {
      desc += `\n * @queryParam {${type}${require ? '' : '?'}} ${name}${description ? `: ${replaceLineBreak(description)}` : ''}`;
    });

    if (formData) {
      const { type, name, description } = formData;
      desc += `\n * @formDataParam {${type}} ${name}${description ? `: ${replaceLineBreak(description)}` : ''}`;
    }
    if (body) {
      const { type, name, description } = body;
      desc += `\n * @bodyParam {${type}} ${name}${description ? `: ${replaceLineBreak(description)}` : ''}`;
    }

    desc += `\n * @return {${returnType}}\n */`;

    return desc;
  }

  /**
   * Retrieves the function arguments based on the provided options.
   *
   * @param {Pick<IDescriptionOption, 'formData' | 'body' | 'paths' | 'querys'>} options - The options object containing the formData, body, paths, and querys properties.
   * @returns {string} A string representation of the function arguments.
   */
  public getFunctionArgs(options: Pick<IDescriptionOption, 'formData' | 'body' | 'paths' | 'querys'>) {
    const { paths, querys, formData, body } = options;
    let str = '';
    paths.forEach((p) => {
      str += `${p.name}: ${p.type}, `;
    });
    if (str.length > 2) str = str.substring(0, str.length - 2);

    if (formData) str += `${str.length > 0 ? ', ' : ''}${formData.name}: ${formData.type}`;

    if (body) str += `${str.length > 0 ? ', ' : ''}${body.name}: ${body.type}`;

    let queryType = querys.length > 0 ? '{\n' : '';
    querys.forEach((p) => {
      queryType += `${INDENT} ${p.orgKey}${p.require ? '' : '?'}: ${p.type},\n`;
    });
    if (querys.length > 0) queryType += '}';
    if (queryType.length > 0) str += `${str.length > 0 ? ', ' : ''}query: ${queryType}`;

    return str;
  }

  public getSimpleReturnType(responses: JSONSchema | undefined, name: string) {
    if (!responses) return 'void';

    let resClass: string;
    let [standardRes] = SwaggerGenTool.getStandardResponse(responses);
    if (standardRes) {
      if (standardRes['anyOf']) standardRes = find(standardRes['anyOf'], (item) => item.type !== 'null');
      resClass = standardRes ? getTsType({ property: standardRes, key: name }) : 'void';
    } else {
      resClass = 'any';
    }
    return this.arraySubClass(resClass);
  }

  public getReturnType(responses: JSONSchema | undefined, resClassName: string) {
    if (!responses) return 'any';
    let resClass: string | undefined;
    let [standardRes, isPagination] = SwaggerGenTool.getStandardResponse(responses);
    if (standardRes) {
      if (standardRes['anyOf']) standardRes = find(standardRes['anyOf'], (item) => item.type !== 'null');
      resClass = standardRes ? getTsType({ property: standardRes, key: resClassName }) : undefined;
    } else {
      resClass = 'any';
    }
    resClass = this.getArrReturnType(resClass, isPagination);
    return resClass !== undefined ? `${resClass}` : 'void';
  }

  public getReqArgs(key: string, method: Method, options: Pick<IDescriptionOption, 'formData' | 'body' | 'paths' | 'querys'>) {
    const { paths, querys, formData, body } = options;
    const { urlPrefix } = SwaggerGenTool.config;
    const path = (urlPrefix ?? '') + key;
    if (!formData && !body && paths.length === 0 && querys.length === 0) return `'${path}'`;
    let str = '',
      reqPath = path;

    paths.forEach(({ name }) => {
      if (reqPath.includes(`{${name}}`)) reqPath = reqPath.replace(`{${name}}`, `\${${name}}`);
      else reqPath += reqPath.endsWith('/') ? `\${${name}}` : `/\${${name}}`;
    });
    str += `'${reqPath}'`;
    if (str.includes('${')) str = `\`${str.substring(1, str.length - 1)}\``;

    if (body && ['put', 'post', 'delete'].includes(method)) {
      const { type } = body;
      const value = SwaggerGenTool.dataModels[type] ?? body.schema;
      const isEnum = SwaggerGenTool.isEnumObject(value);
      if (type?.endsWith('[]')) {
        const subType = type.substring(0, type.length - 2);
        str += TS_TYPE.includes(subType) || isEnum ? ', body' : `, body.map((e) => (new models.${subType}(e)).toJson())`;
      } else {
        str += TS_TYPE.includes(type!) || isEnum ? ', body' : `, body.toJson()`;
      }
    }
    if (formData && !str.includes(', body') && ['put', 'post'].includes(method)) str += ', body';
    if (querys.length > 0) str += ['put', 'post', 'delete'].includes(method) ? `${str.includes(', body') ? '' : ', undefined'}, { params: query }` : `, query`;
    return str;
  }

  /**
   * Generate the content to be returned based on the responses and result class name.
   *
   * @param {JSONSchema | undefined} responses - The responses JSON schema.
   * @param {string} resClassName - The result class name.
   * @return {string} The content to be returned.
   */
  public getReturnContent(responses: JSONSchema | undefined, resClassName: string) {
    const returnType = this.getReturnType(responses, resClassName);
    if (returnType === 'void') return '';
    const [pageName, keyName] = SwaggerGenTool.pageResName;
    const [standardRes] = SwaggerGenTool.getStandardResponse(responses);
    if (!standardRes) return `\n${INDENT}return res;`;

    if (returnType.startsWith(`${pageName}<`)) {
      var subType = returnType.substring(9, returnType.length - 1);
      const value = SwaggerGenTool.dataModels[subType] ?? standardRes;
      const isEnum = SwaggerGenTool.isEnumObject(value);
      if (SwaggerGenTool.requestScript?.getPagingReturnContent) {
        const isSample = TS_TYPE.includes(subType) || isEnum;
        return SwaggerGenTool.requestScript?.getPagingReturnContent(subType, !!isSample);
      }
      return `\n${INDENT}const ${keyName} = res.data ? ${
        TS_TYPE.includes(subType) || isEnum ? `res.data` : `(res.data as any[]).map<${subType}>((v) => ${subType}.fromJson(v))`
      } : [];
  return { ...res.data, ${keyName} };`;
    }
    if (returnType.endsWith('[]')) {
      var subType = returnType.substring(0, returnType.length - 2);
      const value = SwaggerGenTool.dataModels[subType] ?? standardRes;
      const isEnum = SwaggerGenTool.isEnumObject(value);
      return `\n${INDENT}return res.data ? ${
        TS_TYPE.includes(subType) || isEnum ? 'res.data' : `(res.data as any[]).map<${subType}>((v) => ${subType}.fromJson(v))`
      } : [];`;
    }
    const value = SwaggerGenTool.dataModels[returnType] ?? standardRes;
    const isEnum = SwaggerGenTool.isEnumObject(value);
    if (!TS_TYPE.includes(returnType) && !isEnum) return `\n${INDENT}return ${returnType}.fromJson(res.data);`;

    return `\n${INDENT}return res.data;`;
  }

  /// model
  ///
  private getConstructorContent(properties: JSONSchema['properties'], required: (string | number)[] | undefined) {
    let str = '';
    for (const propertyName in properties) {
      const camelPropertyName = camelCase(propertyName);
      str += `${INDENT}${INDENT}this.${camelPropertyName} = data.${camelPropertyName};\n`;
    }
    str = str.length > 0 ? str.substring(4, str.length - 1) : str;
    return str;
  }

  private getPropertiesContent(properties: JSONSchema['properties'], required: (string | number)[] | undefined) {
    let str = '';
    for (const propertyName in properties) {
      const property = properties[propertyName];
      const propType = getTsType({ key: propertyName, property });
      const camelPropertyName = camelCase(propertyName);

      let require = required?.includes(propertyName) ?? false;
      // nullable swagger 3+
      const nullable = Array.isArray(property.type) && find(property.type, (e) => e.toString().includes('null'));
      if (nullable && require) require = false;
      const description = property.title || property.description;
      if (description) str += `${INDENT}/** ${description.replaceAll('\n', `\n${INDENT} * `)} */\n`;
      str += `${INDENT}${camelPropertyName}${require ? '' : '?'}: ${propType};\n\n`;
    }
    str = str.length > 0 ? str.substring(2, str.length - 1) : str;
    return str;
  }

  private getFromJsonContent(properties: JSONSchema['properties'], required: (string | number)[] | undefined) {
    let str = ``;
    for (const propertyName in properties) {
      const property = properties[propertyName];
      const propType = getTsType({ key: propertyName, property });
      const camelPropertyName = camelCase(propertyName);
      const isEnumObject = SwaggerGenTool.isEnumObject(property);

      let require = required?.includes(propertyName) ?? false;
      // nullable swagger 3+
      const nullable = Array.isArray(property.type) && find(property.type, (e) => e.toString().includes('null'));
      if (nullable && require && !propType.endsWith('[]')) require = false;

      str += `${INDENT}${INDENT}${INDENT}${camelPropertyName}: `;
      if (propType.endsWith('[]')) {
        const subType = propType.substring(0, propType.length - 2);
        str += `Array.isArray(json["${propertyName}"]) ? ${
          TS_TYPE.includes(subType) || isEnumObject ? `json["${propertyName}"]` : `json["${propertyName}"].map<${subType}>((v) => ${subType}.fromJson(v))`
        } : [],\n`;
      } else if (!TS_TYPE.includes(propType) && !isEnumObject) {
        str += require
          ? `${propType}.fromJson(json["${propertyName}"]),\n`
          : `json["${propertyName}"] ? ${propType}.fromJson(json["${propertyName}"]) : undefined,\n`;
      } else {
        str += `json["${propertyName}"],\n`;
      }
    }
    str = str.length > 0 ? str.substring(6, str.length - 1) : str;
    return str;
  }

  private getToJsonContent(properties: JSONSchema['properties'], required: (string | number)[] | undefined) {
    let str = '{\n';
    for (const propertyName in properties) {
      const camelPropertyName = camelCase(propertyName);
      const property = properties[propertyName];
      const propType = getTsType({ key: propertyName, property });
      const isEnumObject = SwaggerGenTool.isEnumObject(property);

      let require = required?.includes(propertyName) ?? false;
      // nullable swagger 3+
      const nullable = Array.isArray(property.type) && find(property.type, (e) => e.toString().includes('null'));
      if (nullable && require) require = false;

      str += `${INDENT}${INDENT}${INDENT}"${propertyName}": `;

      if (propType.endsWith('[]')) {
        const subType = propType.substring(0, propType.length - 2);
        if (require)
          str += `this.${TS_TYPE.includes(subType) || isEnumObject ? camelPropertyName : `${camelPropertyName}.map((e: ${subType}) => e.toJson())`},\n`;
        else if (TS_TYPE.includes(subType) || isEnumObject) str += `this.${camelPropertyName},\n`;
        else str += `this.${camelPropertyName} ? ${`this.${camelPropertyName}.map((e: ${subType}) => e.toJson())`} : undefined,\n`;
      } else if (!TS_TYPE.includes(propType) && !isEnumObject) {
        if (require) str += `this.${camelPropertyName}.toJson(),\n`;
        else str += `this.${camelPropertyName} ? this.${camelPropertyName}!.toJson() : undefined,\n`;
      } else {
        str += `this.${camelPropertyName},\n`;
      }
    }
    str += `${INDENT}${INDENT}}`;
    return str;
  }
}
