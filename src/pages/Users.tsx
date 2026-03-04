import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/src/components/ui/Table';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useToast } from '@/src/components/ui/Toast';
import { UserPlus, Search, MoreHorizontal, RotateCcw, UserX, Edit2, Users as UsersIcon } from 'lucide-react';
import { mockUsers } from '@/src/mockData';
import { cn } from '@/src/utils/cn';

export function UsersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const formatTraffic = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const filteredUsers = mockUsers.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = (action: string, username: string) => {
    toast(`${action} performed for ${username}`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-zinc-400 mt-1">Manage your proxy users and their limits.</p>
        </div>
        <Button className="gap-2" onClick={() => toast('Add User feature coming soon', 'info')}>
          <UserPlus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>User Management</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input 
                placeholder="Search users..." 
                className="pl-10 h-9" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-24" />
                </div>
              ))}
            </div>
          ) : filteredUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead className="hidden lg:table-cell">UUID</TableHead>
                  <TableHead>Traffic Usage</TableHead>
                  <TableHead className="hidden md:table-cell">Devices</TableHead>
                  <TableHead className="hidden sm:table-cell">Expire Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const usagePercent = (user.trafficUsed / user.trafficLimit) * 100;
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell className="font-mono text-xs text-zinc-500 hidden lg:table-cell">
                        {user.uuid.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 min-w-[120px]">
                          <div className="flex justify-between text-[10px] text-zinc-500">
                            <span>{formatTraffic(user.trafficUsed)}</span>
                            <span>{formatTraffic(user.trafficLimit)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                usagePercent < 70 ? "bg-emerald-500" : 
                                usagePercent < 90 ? "bg-yellow-500" : "bg-red-500"
                              )}
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{user.deviceLimit}</TableCell>
                      <TableCell className="hidden sm:table-cell text-zinc-400 text-xs">{user.expireTime}</TableCell>
                      <TableCell>
                        <Badge variant={
                          user.status === 'active' ? 'success' : 
                          user.status === 'disabled' ? 'secondary' : 'destructive'
                        }>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction('Edit', user.username)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction('Reset Traffic', user.username)}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => handleAction('Disable', user.username)}>
                            <UserX className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState 
              icon={UsersIcon}
              title="No users found"
              description={searchQuery ? `No users matching "${searchQuery}"` : "You haven't added any users yet."}
              actionLabel={searchQuery ? "Clear Search" : "Add User"}
              onAction={() => searchQuery ? setSearchQuery('') : toast('Add User feature coming soon', 'info')}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
