type SidebarSection = 'home' | 'setup' | 'help';

export function getSidebarSubtitle(
  pathname: string,
  section: SidebarSection,
  isZh: boolean,
): string {
  if (pathname === '/profile') return isZh ? '个人资料' : 'Profile';
  if (section === 'help') return isZh ? '帮助' : 'Help';
  if (section === 'setup') return isZh ? '概览' : 'Overview';
  return isZh ? '使用订阅' : 'Set up';
}
