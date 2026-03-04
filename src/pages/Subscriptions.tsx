import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { 
  Copy, 
  QrCode, 
  Download, 
  Smartphone, 
  Monitor, 
  Apple, 
  Wind,
  ExternalLink
} from 'lucide-react';

export function SubscriptionsPage() {
  const subLink = "https://sub.proxydog.io/v1/subscribe?token=550e8400-e29b-41d4-a716-446655440000";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(subLink);
    alert('Copied to clipboard!');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-zinc-400 mt-1">Get your connection links and client software.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Subscription Link</CardTitle>
            <CardDescription>Use this link to import nodes into your client software.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div className="flex gap-2">
              <Input value={subLink} readOnly className="font-mono text-xs bg-zinc-900" />
              <Button variant="outline" size="icon" onClick={copyToClipboard}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="w-full gap-2">
                <QrCode className="w-4 h-4" />
                Show QR Code
              </Button>
              <Button variant="secondary" className="w-full gap-2">
                <ExternalLink className="w-4 h-4" />
                Import to Clash
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Your current subscription status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-zinc-400">Status</span>
              <span className="text-emerald-500 font-medium">Active</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-zinc-400">Traffic Limit</span>
              <span>100 GB</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-zinc-400">Expire Time</span>
              <span>2025-12-31</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Client Downloads</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { name: 'Windows', icon: Wind, version: 'v2.4.1' },
            { name: 'macOS', icon: Apple, version: 'v2.3.0' },
            { name: 'Android', icon: Smartphone, version: 'v1.9.5' },
            { name: 'iOS', icon: Smartphone, version: 'App Store' },
          ].map((client) => (
            <Card key={client.name} className="flex flex-col items-center p-6 text-center hover:bg-white/5 transition-colors cursor-pointer">
              <client.icon className="w-10 h-10 mb-4 text-zinc-400" />
              <h3 className="font-semibold">{client.name}</h3>
              <p className="text-xs text-zinc-500 mb-4">{client.version}</p>
              <Button variant="outline" size="sm" className="w-full gap-2">
                <Download className="w-4 h-4" />
                Download
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
