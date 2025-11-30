import ThemeSwitch from '@/components/ThemeSwitch';
import useTheme from '@/models/useTheme';
import { ProLayout } from '@ant-design/pro-components';
import {
  Link,
  Outlet,
  useAppData,
  useLocation,
  useModel,
  useNavigate,
} from '@umijs/max';
import React, { useEffect } from 'react';
import styles from './index.module.less';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clientRoutes } = useAppData();
  const { initialState } = useModel('@@initialState');
  const { theme: currentTheme } = useTheme();

  // 获取路由配置
  // 直接定义路由配置，而不是从 clientRoutes 中查找
  const routes = [
    {
      path: '/',
      redirect: '/schema2code',
    },
    {
      hideInMenu: true,
      name: 'snippets',
      path: '/snippets',
      component: './snippets',
    },
    {
      hideInMenu: true,
      name: '代码片段详情',
      path: '/material-detail/:name',
      component: './materials/detail',
    },
    {
      hideInMenu: true,
      name: '创建代码片段',
      path: '/material-create',
      component: './materials/create',
    },
    {
      name: 'schema2code',
      path: '/schema2code',
      component: './schema2code',
    },
    {
      name: '物料中心',
      path: '/materials',
      component: './materials',
    },
    {
      name: '脚手架',
      path: '/scaffold',
      component: './scaffold',
    },
    {
      name: '讯飞大模型',
      path: '/aigc_code',
      component: './aigc_code',
    },
    {
      name: '项目配置',
      path: '/config',
      component: './config',
    },
  ];

  const route = {
    path: '/',
    routes,
  };

  // 设置页面标题
  useEffect(() => {
    document.title = 'Vg Code';
  }, []);

  return (
    <ProLayout
      route={route}
      location={location}
      title="Vg Code"
      navTheme={currentTheme === 'dark' ? 'realDark' : 'light'}
      layout="top"
      // fixedHeader
      // fixSiderbar
      logo="https://os.vghub.top/static/logo.png"
      menuItemRender={(menuItemProps, defaultDom) => {
        if (menuItemProps.isUrl || menuItemProps.children) {
          return defaultDom;
        }
        if (menuItemProps.path && location.pathname !== menuItemProps.path) {
          return (
            <Link
              to={menuItemProps.path.replace('/*', '')}
              target={menuItemProps.target}
            >
              {defaultDom}
            </Link>
          );
        }
        return defaultDom;
      }}
      rightContentRender={() => (
        <div className={styles.umiPluginLayoutRight}>
          <ThemeSwitch />
        </div>
      )}
    >
      <Outlet />
    </ProLayout>
  );
};

export default Layout;
