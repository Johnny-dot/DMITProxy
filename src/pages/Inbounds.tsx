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
import { Plus, Search, Edit2, Trash2, Power, PowerOff, ShieldCheck } from 'lucide-react';
import { mockInbounds } from '@/src/mockData';
import { cn } from '@/src/utils/cn';

export function InboundsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const formatTraffic = (bytes: number) => {
    if (bytes === 0) return 'Unlimited';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
    return `${gb.toFixed(2)} GB`;
  };

  const getProtocolColor = (protocol: string) => {
    switch (protocol) {
      case 'VLESS': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      case 'VMess': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Trojan': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Shadowsocks': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  const filteredInbounds = mockInbounds.filter(i => 
    i.remark.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.protocol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = (action: string, remark: string) => {
    toast(`${action} performed for ${remark}`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbounds</h1>
          <p className="text-zinc-400 mt-1">Manage your Xray inbound configurations.</p>
        </div>
        <Button className="gap-2" onClick={() => toast('Add Inbound feature coming soon', 'info')}>
          <Plus className="w-4 h-4" />
          Add Inbound
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>Inbound Configurations</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input 
                placeholder="Search inbounds..." 
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
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredInbounds.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead>Protocol</TableHead>
                  <TableHead className="hidden md:table-cell">Port</TableHead>
                  <TableHead>Traffic (Used / Total)</TableHead>
                  <TableHead className="hidden sm:table-cell">Clients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInbounds.map((inbound) => (
                  <TableRow key={inbound.id}>
                    <TableCell className="text-zinc-500 font-mono text-xs">{inbound.id}</TableCell>
                    <TableCell className="font-medium">{inbound.remark}</TableCell>
                    <TableCell>
                      <Badge className={cn("border", getProtocolColor(inbound.protocol))}>
                        {inbound.protocol}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono hidden md:table-cell">{inbound.port}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 min-w-[100px]">
                        <div className="flex justify-between text-[10px] text-zinc-500">
                          <span>{formatTraffic(inbound.usedTraffic)}</span>
                          <span>{formatTraffic(inbound.totalTraffic)}</span>
                        </div>
                        <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              (inbound.usedTraffic / inbound.totalTraffic) > 0.9 ? "bg-red-500" : "bg-indigo-500"
                            )}
                            style={{ width: inbound.totalTraffic > 0 ? `${(inbound.usedTraffic / inbound.totalTraffic) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{inbound.clientCount}</TableCell>
                    <TableCell>
                      <Badge variant={inbound.status === 'enabled' ? 'success' : 'secondary'}>
                        {inbound.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction(inbound.status === 'enabled' ? 'Disable' : 'Enable', inbound.remark)}>
                          {inbound.status === 'enabled' ? <PowerOff className="w-3.5 h-3.5 text-zinc-500" /> : <Power className="w-3.5 h-3.5 text-emerald-500" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction('Edit', inbound.remark)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => handleAction('Delete', inbound.remark)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState 
              icon={ShieldCheck}
              title="No inbounds found"
              description={searchQuery ? `No inbounds matching "${searchQuery}"` : "You haven't configured any inbounds yet."}
              actionLabel={searchQuery ? "Clear Search" : "Add Inbound"}
              onAction={() => searchQuery ? setSearchQuery('') : toast('Add Inbound feature coming soon', 'info')}
            />
          )}
        </CardContent>
      </Card>
      
      <div className="bg-zinc-900/30 border border-white/5 rounded-lg p-4 text-sm text-zinc-500">
        <p>Note: Inbound configurations are directly managed from the Xray core. Changes here will affect server connectivity immediately.</p>
      </div>
    </div>
  );
}
