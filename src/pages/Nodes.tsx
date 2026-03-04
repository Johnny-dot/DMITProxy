import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Globe, Signal, Zap, Plus, Info } from 'lucide-react';
import { mockNodes } from '@/src/mockData';
import { cn } from '@/src/utils/cn';

export function NodesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nodes</h1>
          <p className="text-zinc-400 mt-1">Infrastructure nodes providing proxy services.</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Node
        </Button>
      </div>

      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 flex gap-3 text-sm text-indigo-300">
        <Info className="w-5 h-5 flex-shrink-0" />
        <p>Note: These nodes represent the physical infrastructure. Connection configurations are managed via Inbounds, which are linked to these nodes through 3X-UI inbound configs.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockNodes.map((node) => (
          <Card key={node.id} className="group hover:border-white/20 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  node.status === 'online' ? "bg-emerald-500/10" : "bg-red-500/10"
                )}>
                  <Globe className={cn(
                    "w-5 h-5",
                    node.status === 'online' ? "text-emerald-500" : "text-red-500"
                  )} />
                </div>
                <div>
                  <CardTitle className="text-base">{node.name}</CardTitle>
                  <p className="text-xs text-zinc-500">{node.location}</p>
                </div>
              </div>
              <Badge variant={node.status === 'online' ? 'success' : 'destructive'}>
                {node.status}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Signal className="w-4 h-4" />
                    Latency
                  </div>
                  <span className={cn(
                    "font-medium",
                    node.latency < 100 ? "text-emerald-500" : node.latency < 200 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {node.latency} ms
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Zap className="w-4 h-4" />
                      Load
                    </div>
                    <span className="font-medium">{node.load}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        node.load < 50 ? "bg-emerald-500" : node.load < 80 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${node.load}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">Edit</Button>
                <Button variant="outline" size="sm" className="flex-1">Stats</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
