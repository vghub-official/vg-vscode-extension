/*
 * @Author: zdd
 * @Date: 2023-06-27 22:07:27
 * @LastEditors: Zdd 445305451@qq.com
 * @LastEditTime: 2025-11-30 10:23:03
 * @FilePath: index.tsx
 * @Description:
 */

import { getLocalSchemas } from '@/common';
import CodeMirror from '@/components/CodeMirror';
import GenPage from '@/components/GenPage';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMount } from 'ahooks';
import { Menu } from 'antd';
import { useEffect, useState } from 'react';
import { useImmer } from 'use-immer';

export type TableListItem = {
  key: number;
  name: string;
  createdAt: number;
  progress: number;
  methodName: string;
  summary: string;
};

const Schema2codePage: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState('');
  const [menuItems, setMenuItems] = useImmer<any[]>([]);
  const [formModal, setFormModal] = useImmer<any>({
    visible: false,
  });
  const [schemas, setSchemas] = useImmer<Record<string, any>>({});
  const [openKeys, setOpenKeys] = useImmer<string[]>([]);
  const [modelList, setModelList] = useImmer<any[]>([]);

  // 定义基础列
  const baseColumns: ProColumns<TableListItem>[] = [
    {
      title: '序号',
      dataIndex: 'index',
      valueType: 'index',
      width: 80,
    },
    {
      title: 'methodName',
      key: 'methodName',
      dataIndex: 'methodName',
    },
    {
      title: 'summary',
      dataIndex: 'summary',
    },
  ];

  useMount(async () => {
    const _schemas = await getLocalSchemas();

    setSchemas(_schemas);
    const _menuItems: any[] = [];
    for (let keyT in _schemas) {
      if (keyT.startsWith('/')) keyT = keyT.substring(1);
      if (selectedKey == '') setSelectedKey(keyT);
      const paths = keyT.split('/');
      for (let j = 0; j < paths.length; j++) {
        var distArr = new Array(j + 1).fill(0).map((_, i) => paths[i]);
        const label = paths[j];
        let current: any = {};
        let children: any[] = [];
        distArr.forEach((val, i) => {
          if (i == 0) {
            children = _menuItems;
          } else if (current) {
            if (!current.children) {
              current.children = [];
            }
            children = current.children;
          }
          if (!children.find((item) => item.label == val)) {
            const key = distArr.slice(0, i + 1).join('/');
            current = {
              key,
              label,
            };
            children.push(current);
          } else {
            current = children.find((item) => item.label == val);
          }
        });
      }
    }
    setMenuItems(_menuItems);
  });

  useEffect(() => {
    const keys = selectedKey.split('/');
    const _openKeys: string[] = [];
    keys.forEach((_, i) => {
      _openKeys.push(keys.slice(0, i + 1).join('/'));
    });
    setOpenKeys(_openKeys);
  }, [selectedKey]);

  return (
    <>
      <GenPage
        visible={formModal.visible}
        config={formModal.config}
        pageName={formModal.pageName}
        modelList={modelList}
        onClose={(ok) => {
          setFormModal((s: any) => {
            s.visible = false;
          });
        }}
      />
      <ProTable<TableListItem>
        search={false}
        columns={[
          ...baseColumns,
          {
            title: '操作',
            valueType: 'option',
            key: 'option',
            width: 120,
            render: (_, record) => {
              if (
                record.methodName.startsWith('update') ||
                record.methodName.startsWith('delete')
              ) {
                return [];
              }
              return [
                <a
                  key="editable"
                  onClick={() => {
                    setFormModal({
                      visible: true,
                      config: record,
                      pageName: selectedKey,
                    });
                  }}
                >
                  生成page
                </a>,
              ];
            },
          },
        ]}
        rowKey="methodName"
        pagination={false}
        tableRender={(_: any, dom: any) => (
          <div
            style={{
              display: 'flex',
              width: '100%',
            }}
          >
            <Menu
              onSelect={(e) => {
                setSelectedKey(e.key as string);
              }}
              style={{ width: 256 }}
              openKeys={openKeys}
              selectedKeys={[selectedKey]}
              onOpenChange={setOpenKeys}
              mode="inline"
              items={menuItems}
            />
            <div
              style={{
                flex: 1,
              }}
            >
              {dom}
            </div>
          </div>
        )}
        params={{
          selectedKey,
        }}
        expandable={{
          expandedRowRender: (record: any) => (
            <CodeMirror
              domId={'templateCodeMirror_' + record.methodName}
              readonly={true}
              value={record.code}
            />
          ),
        }}
        request={async () => {
          var tableListDataSource: any[] = [];
          const findKey = Object.keys(schemas).find((key) =>
            key.startsWith('/')
              ? key.substring(1) == selectedKey
              : key == selectedKey,
          );
          if (selectedKey != '' && findKey) {
            const [apis, models] = schemas[findKey];
            tableListDataSource = apis;
            setModelList(models);
          }

          return {
            success: true,
            data: tableListDataSource.map((item) => ({
              ...item,
              code: JSON.stringify(item, null, 2),
            })),
          };
        }}
        dateFormatter="string"
        headerTitle="包含model类"
      />
    </>
  );
};

export default Schema2codePage;
