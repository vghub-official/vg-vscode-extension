import { compile as compileEjs, first, join, mkdirpSync, existsSync, writeFileSync, camelCase, isRegExp, find, writeFile } from '@root/utils';
import type { SwaggerPath, Method, SwaggerHttpEndpoint, IParameter, FilesMap, FilesMapModel } from '../index.d';
import { METHOD_MAP, SwaggerGenTool, filterPathName, getClassName, getDirPath, getParamObj } from '../utils';
import { getModelClassContent } from './model_tool';
import { filter, forEach } from 'lodash';

class RequestGenerate {
  paths: SwaggerPath;
  filesMap: FilesMap;
  overwrite = SwaggerGenTool.config.overwrite ?? false;

  constructor(paths: SwaggerPath) {
    this.paths = paths;
    this.filesMap = {};
  }

  async generateAllRequest() {
    for (let key in this.paths) for (let method in this.paths[key]) this.generateRequest(key, method as Method, this.paths[key][method as Method]);

    let indexFileContnet = SwaggerGenTool.implementor.getIndexFileContnet();
    const targetDir = SwaggerGenTool.targetDirectory;

    let sharedModel: Array<{ name: string; count: number; content: string }> = [];
    for (let key in this.filesMap) {
      let [_, modelContents] = this.filesMap[key];
      modelContents.forEach(([name, content]) => {
        const obj = find(sharedModel, { name, content });
        if (obj) obj.count++;
        else sharedModel.push({ name, content, count: 1 });
      });
    }
    sharedModel = filter(sharedModel, ({ count }) => count > 1);

    // request内容写入
    for (let key in this.filesMap) {
      let modelEmpty = false;
      let [apiContent, modelContents, deeps] = this.filesMap[key];
      if (modelContents.length === 0) modelEmpty = true;
      indexFileContnet += SwaggerGenTool.implementor.getIndexFileContnet(key.replace(targetDir, ''), modelEmpty);
      let modelContent = '';
      const sharedModelNames: string[] = [];
      modelContents.forEach(([name, content]) => {
        const obj = find(sharedModel, { name, content });
        if (obj) {
          if (!sharedModelNames.includes(name)) sharedModelNames.push(name);
        } else {
          modelContent += content + '\n\n';
        }
      });
      if (modelContent.endsWith('\n\n')) modelContent = modelContent.substring(0, modelContent.length - 2);
      SwaggerGenTool.implementor.wirtFile(this.overwrite, key, {
        deeps,
        apiContent,
        sharedModelNames,
        modelContent,
      });
    }
    const fileExtension = SwaggerGenTool.implementor.fileExtension;

    // 内容写入 sharedModel
    if (sharedModel.length !== 0) {
      let modelContent = SwaggerGenTool.modelHeader + '\n' + sharedModel.map(({ content }) => content).join('\n\n');
      const filePath = join(targetDir, `shared_model.g.${fileExtension}`);
      if (!this.overwrite) writeFile(join(targetDir, 'shared_model.g.vg'), modelContent, 'utf-8');
      else if (!existsSync(filePath) || this.overwrite) writeFile(filePath, modelContent, 'utf-8');
    }

    // 内容写入 index
    if (!existsSync(join(targetDir, `index.${fileExtension}`))) writeFileSync(join(targetDir, `index.${fileExtension}`), indexFileContnet, 'utf-8');
    writeFileSync(join(targetDir, 'index.text'), indexFileContnet, 'utf-8');

    // 内容写入 base_http
    if (!existsSync(join(targetDir, `base_http.${fileExtension}`)))
      writeFileSync(join(targetDir, `base_http.${fileExtension}`), SwaggerGenTool.getMaterialTemplateWithName('base_http'), 'utf-8');
    SwaggerGenTool.writeExceptionToFile(targetDir);
  }

  generateRequest(key: string, method: Method, value: SwaggerHttpEndpoint) {
    let folder = SwaggerGenTool.getFolder(key, method, value);
    if (!folder) return;
    let { dirPath, deeps, className } = getDirPath(folder);
    if (key.startsWith('/v3/co/project/dispatch-enters')) {
      console.log({ key });
      console.log(value.successResponse);
    }

    if (!existsSync(dirPath)) mkdirpSync(dirPath);
    const keyLast = SwaggerGenTool.methodNameExchange(key);
    if (!keyLast) return;
    // 写入 class 头
    if (!this.filesMap[dirPath]) {
      const apiHeader = SwaggerGenTool.implementor.getReqHeader(SwaggerGenTool.modelHeader, deeps, className);
      this.filesMap[dirPath] = [apiHeader, [], deeps];
    }

    var _name = filterPathName(keyLast.split('_'));

    this.filesMap[dirPath][1] = getModelClassContent(_name, value, this.filesMap[dirPath][1]);
    const reqClassName = getClassName(_name);

    const params = this.getParams(value.parameters, reqClassName);
    let returnType = SwaggerGenTool.implementor.getReturnType(value.successResponse, getClassName(_name, false));

    const description = SwaggerGenTool.implementor.getDescription({
      ...value,
      ...params,
      returnType,
    });
    const funcName = camelCase(METHOD_MAP[method] + '_' + keyLast);
    const functionArgs = SwaggerGenTool.implementor.getFunctionArgs(params);
    const reqArgs = SwaggerGenTool.implementor.getReqArgs(key, method, params);
    const returnContent = SwaggerGenTool.implementor.getReturnContent(value.successResponse, getClassName(_name, false));
    const template = SwaggerGenTool.getMaterialTemplateWithName('request');

    // 写入请求
    this.filesMap[dirPath][0] += compileEjs(template, {
      description,
      returnType,
      funcName,
      functionArgs,
      method: method.toLowerCase(),
      reqArgs,
      returnContent,
    } as any);
  }

  getParams(parameters: SwaggerHttpEndpoint['parameters'], reqClassName: string) {
    const data = getParamObj(parameters);
    if (!data) return { paths: [] as IParameter[], querys: [] as IParameter[] };
    const { pathParams, queryParams, formDataParams, bodyParams } = data;
    const paths = pathParams.map(SwaggerGenTool.implementor.pathParam);
    const querys = queryParams.map(SwaggerGenTool.implementor.pathParam);

    let formData, body;
    if (formDataParams.length > 0)
      formData = {
        name: 'body',
        orgKey: 'body',
        require: true,
        type: SwaggerGenTool.implementor.formDataType,
        description: formDataParams[0].description,
      };

    if (bodyParams.length > 0) body = { ...SwaggerGenTool.implementor.pathParam({ ...first(bodyParams)!, name: reqClassName }), name: 'body', require: true };

    return { paths, querys, formData, body };
  }
}

export default RequestGenerate;
