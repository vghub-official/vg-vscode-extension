import React from 'react';
import { Switch, Tooltip } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import useTheme from '@/models/useTheme';
import styles from './index.module.less';

const ThemeSwitch: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  const handleThemeChange = (checked: boolean) => {
    toggleTheme();
  };

  return (
    <Tooltip title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}>
      <div className={styles.themeSwitch}>
        {theme === 'light' ? <SunOutlined /> : <MoonOutlined />}
        <Switch
          checked={theme === 'dark'}
          onChange={handleThemeChange}
          size="small"
          className={styles.themeSwitchControl}
        />
      </div>
    </Tooltip>
  );
};

export default ThemeSwitch;