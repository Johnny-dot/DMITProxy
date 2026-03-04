import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/src/components/ui/Table';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useToast } from '@/src/components/ui/Toast';
import { Activity, RefreshCw, XCircle, Users as UsersIcon } from 'lucide-react';
import { mockOnlineUsers } from '@/src/mockData';

export function OnlineUsersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast('Online users list updated', 'success');
    }, 600);
  };

  const handleDisconnect = (username: string) => {
    toast(`User ${username} disconnected`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Online Users</h1>
          <p className="text-zinc-400 mt-1">Real-time connection monitoring.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleRefresh}>
          <RefreshCw className={isLoading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <CardTitle>Active Connections</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : mockOnlineUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Node</TableHead>
                  <TableHead className="hidden sm:table-cell">Connections</TableHead>
                  <TableHead className="hidden md:table-cell">Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockOnlineUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="font-mono text-xs">{user.ip}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.nodeName}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{user.connectionCount}</TableCell>
                    <TableCell className="hidden md:table-cell">{user.duration}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-400 hover:bg-red-500/10 gap-2"
                        onClick={() => handleDisconnect(user.username)}
                      >
                        <XCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Disconnect</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState 
              icon={UsersIcon}
              title="No active connections"
              description="There are currently no users connected to any nodes."
              actionLabel="Refresh List"
              onAction={handleRefresh}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
