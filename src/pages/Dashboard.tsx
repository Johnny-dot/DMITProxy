import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Activity, 
  Zap, 
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
  HardDrive,
  Database,
  ArrowUp,
  ArrowDown,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { mockTrafficHistory, mockOnlineUsersHistory, mockServerStatus } from '@/src/mockData';
import { cn } from '@/src/utils/cn';
import { Badge } from '@/src/components/ui/Badge';
import { Skeleton } from '@/src/components/ui/Skeleton';

const stats = [
  { title: 'Total Users', value: '42', icon: Users, trend: '+12%', trendUp: true, color: 'emerald' },
  { title: 'Online Users', value: '18', icon: Activity, trend: 'Active now', trendUp: true, color: 'indigo' },
  { title: 'Traffic Today', value: '1.2 TB', icon: Zap, trend: '+5.4%', trendUp: true, color: 'amber' },
  { title: 'Server Load', value: '24%', icon: Cpu, trend: 'Stable', trendUp: true, color: 'rose' },
];

export function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    const kbps = bytesPerSec / 1024;
    if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`;
    return `${kbps.toFixed(1)} KB/s`;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Welcome back, here's what's happening today.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card 
            key={stat.title} 
            className={cn(
              "relative overflow-hidden group transition-all duration-300",
              stat.color === 'emerald' && "hover:border-emerald-500/50",
              stat.color === 'indigo' && "hover:border-indigo-500/50",
              stat.color === 'amber' && "hover:border-amber-500/50",
              stat.color === 'rose' && "hover:border-rose-500/50"
            )}
          >
            <div className={cn(
              "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none",
              stat.color === 'emerald' && "bg-emerald-500",
              stat.color === 'indigo' && "bg-indigo-500",
              stat.color === 'amber' && "bg-amber-500",
              stat.color === 'rose' && "bg-rose-500"
            )} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className={cn(
                    "text-xs mt-1 flex items-center gap-1",
                    stat.trendUp ? "text-emerald-500" : "text-red-500"
                  )}>
                    {stat.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.trend}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Traffic Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockTrafficHistory}>
                  <defs>
                    <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#71717a" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#71717a" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}MB`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="download" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorDownload)" 
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="upload" 
                    stroke="#6366f1" 
                    fillOpacity={1} 
                    fill="url(#colorUpload)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Server Status</CardTitle>
              <CardDescription>Real-time resource monitoring</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                mockServerStatus.xrayStatus === 'running' ? "bg-emerald-500" : "bg-red-500"
              )} />
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Xray</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Cpu className="w-4 h-4" />
                      CPU Usage
                    </div>
                    <span className="font-medium">{mockServerStatus.cpu}%</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        mockServerStatus.cpu < 50 ? "bg-emerald-500" : mockServerStatus.cpu < 80 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${mockServerStatus.cpu}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Database className="w-4 h-4" />
                      RAM Usage
                    </div>
                    <span className="font-medium">{formatBytes(mockServerStatus.ram.used)} / {formatBytes(mockServerStatus.ram.total)}</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${(mockServerStatus.ram.used / mockServerStatus.ram.total) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <HardDrive className="w-4 h-4" />
                      Disk Usage
                    </div>
                    <span className="font-medium">{formatBytes(mockServerStatus.disk.used)} / {formatBytes(mockServerStatus.disk.total)}</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-zinc-500 rounded-full transition-all"
                      style={{ width: `${(mockServerStatus.disk.used / mockServerStatus.disk.total) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Network Speed</p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs">
                        <ArrowUp className="w-3 h-3 text-indigo-500" />
                        <span>{formatSpeed(mockServerStatus.network.up)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <ArrowDown className="w-3 h-3 text-emerald-500" />
                        <span>{formatSpeed(mockServerStatus.network.down)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Uptime</p>
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>{mockServerStatus.uptime}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
