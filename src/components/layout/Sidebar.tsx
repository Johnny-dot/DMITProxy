import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Server, 
  Users, 
  Activity, 
  BarChart3, 
  Link as LinkIcon, 
  Settings,
  Dog
} from 'lucide-react';
import { cn } from '@/src/utils/cn';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Server, label: 'Nodes', path: '/nodes' },
  { icon: Users, label: 'Users', path: '/users' },
  { icon: Activity, label: 'Online Users', path: '/online' },
  { icon: BarChart3, label: 'Traffic', path: '/traffic' },
  { icon: LinkIcon, label: 'Subscriptions', path: '/subscriptions' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-white/10 bg-zinc-950 flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-zinc-50 rounded-lg flex items-center justify-center">
          <Dog className="w-5 h-5 text-zinc-950" />
        </div>
        <span className="font-bold text-xl tracking-tight text-zinc-50">ProxyDog</span>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 mt-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive 
                ? "bg-zinc-800 text-zinc-50" 
                : "text-zinc-400 hover:text-zinc-50 hover:bg-white/5"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500" />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-zinc-50">Admin User</span>
            <span className="text-[10px] text-zinc-500">admin@proxydog.io</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
