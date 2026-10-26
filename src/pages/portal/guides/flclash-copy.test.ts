import { describe, expect, it } from 'vitest';
import { zhCN } from '@/src/i18n/locales/zh-CN';

describe('FlClash Chinese guide copy', () => {
  it('uses the button names from the Chinese FlClash screenshots', () => {
    const windows = zhCN.guides.flClash.windows;
    expect(windows.step0.description).toContain('「配置」');
    expect(windows.step0.description).not.toContain('New Configuration');
    expect(windows.step1.visualItems).toEqual(['名称', 'URL', '自动更新间隔', '保存']);
    expect(windows.step3.description).toContain('节点选择');
    expect(windows.step4.description).toContain('系统代理');
    expect(zhCN.guides.flClash.linux.step0.visualItems).toEqual(['配置', '添加', '从 URL 导入']);
  });
});
