import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/Tabs';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { useToast } from '@/src/components/ui/Toast';
import { 
  Copy, 
  QrCode, 
  Download, 
  Smartphone, 
  Monitor, 
  Apple, 
  Wind,
  ExternalLink,
  Check,
  Shield,
  Zap,
  Lock,
  Terminal,
  Info,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/src/utils/cn';

export function SubscriptionsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState('universal');
  const [activeOsTab, setActiveOsTab] = useState('windows');
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const subLinks = {
    universal: "https://sub.proxydog.io/v1/subscribe?token=550e8400-e29b-41d4-a716-446655440000",
    clash: "https://sub.proxydog.io/v1/subscribe?token=550e8400-e29b-41d4-a716-446655440000&flag=clash",
    v2ray: "https://sub.proxydog.io/v1/subscribe?token=550e8400-e29b-41d4-a716-446655440000&flag=v2ray",
    singbox: "https://sub.proxydog.io/v1/subscribe?token=550e8400-e29b-41d4-a716-446655440000&flag=sing-box",
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast('Copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const tutorials = {
    windows: [
      { client: 'v2rayN', steps: ['Download v2rayN from the link above.', 'Extract the zip file and run v2rayN.exe.', 'Click "Servers" -> "Import bulk URL from clipboard".', 'Right-click the system tray icon and set "System Proxy" to "Global".'] },
      { client: 'Clash Verge', steps: ['Download and install Clash Verge.', 'Go to "Profiles" and paste your Clash subscription link.', 'Click "Import" and select the new profile.', 'Enable "System Proxy" in the "Settings" tab.'] },
    ],
    macos: [
      { client: 'Clash Verge', steps: ['Download and install Clash Verge for macOS.', 'Paste your Clash subscription link in the "Profiles" section.', 'Select the imported profile and click "Use".', 'Enable "System Proxy" in the menu bar or settings.'] },
    ],
    ios: [
      { client: 'Shadowrocket', steps: ['Open Shadowrocket on your iOS device.', 'Tap the "+" icon in the top right corner.', 'Select "Type" as "Subscribe" and paste your Universal link.', 'Swipe down to refresh the server list and select a node.'] },
    ],
    android: [
      { client: 'v2rayNG', steps: ['Download and install v2rayNG.', 'Tap the menu icon and select "Subscription setting".', 'Tap the "+" icon and paste your Universal link.', 'Go back, tap the menu again, and select "Update subscription".'] },
      { client: 'Hiddify', steps: ['Install Hiddify from Play Store.', 'Tap "New Profile" and paste your subscription link.', 'Tap "Connect" to start the proxy.', 'Hiddify automatically selects the best node for you.'] },
    ],
    linux: [
      { client: 'Hiddify Next', steps: ['Download the AppImage or deb package.', 'Import your Universal subscription link.', 'Click "Connect" to start.', 'Configure your browser to use the local proxy port.'] },
    ],
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-zinc-400 mt-1">Manage your connection links and follow setup tutorials.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-full text-xs font-medium border border-emerald-500/20">
          <Shield className="w-3.5 h-3.5" />
          Subscription Active
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Subscription Links</CardTitle>
            <CardDescription>Select your preferred format to import into your client.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger active={activeSubTab === 'universal'} onClick={() => setActiveSubTab('universal')}>Universal</TabsTrigger>
                <TabsTrigger active={activeSubTab === 'clash'} onClick={() => setActiveSubTab('clash')}>Clash</TabsTrigger>
                <TabsTrigger active={activeSubTab === 'v2ray'} onClick={() => setActiveSubTab('v2ray')}>V2Ray</TabsTrigger>
                <TabsTrigger active={activeSubTab === 'singbox'} onClick={() => setActiveSubTab('singbox')}>Singbox</TabsTrigger>
              </TabsList>
              
              {Object.entries(subLinks).map(([key, link]) => (
                <TabsContent key={key} active={activeSubTab === key} className="space-y-4">
                  <div className="flex gap-2">
                    <Input value={link} readOnly className="font-mono text-xs bg-zinc-900/50 border-white/5" />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => copyToClipboard(link, key)}
                      className="relative"
                    >
                      {copiedId === key ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" className="gap-2">
                      <ExternalLink className="w-3.5 h-3.5" />
                      One-click Import
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                      <QrCode className="w-3.5 h-3.5" />
                      Show QR
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Usage and expiration info.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-zinc-400 text-sm">Traffic Used</span>
              <span className="font-medium">45.2 GB / 100 GB</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-zinc-400 text-sm">Reset Date</span>
              <span className="font-medium">Every 1st of month</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-zinc-400 text-sm">Expire Time</span>
              <span className="text-indigo-400 font-medium">2025-12-31</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Protocol Share Cards
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { name: 'VLESS', icon: Shield, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            { name: 'VMess', icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { name: 'Trojan', icon: Lock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          ].map((proto) => (
            <Card key={proto.name} className="overflow-hidden">
              <CardContent className="p-0">
                <div className={cn("p-4 flex items-center justify-between border-b border-white/5", proto.bg)}>
                  <div className="flex items-center gap-2">
                    <proto.icon className={cn("w-4 h-4", proto.color)} />
                    <span className="font-bold text-sm tracking-wide">{proto.name}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-[10px] uppercase tracking-wider"
                    onClick={() => copyToClipboard(`${proto.name.toLowerCase()}://token@node.proxydog.io:443`, proto.name)}
                  >
                    {copiedId === proto.name ? 'Copied' : 'Copy Node'}
                  </Button>
                </div>
                <div className="p-8 flex flex-col items-center justify-center bg-zinc-900/20">
                  <div className="w-32 h-32 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center relative group cursor-pointer hover:border-white/20 transition-colors">
                    <QrCode className="w-12 h-12 text-zinc-800 group-hover:text-zinc-700 transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950/40 rounded-xl">
                      <span className="text-[10px] font-medium uppercase tracking-tighter">Click to enlarge</span>
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] text-zinc-500 uppercase tracking-widest">Scan to import {proto.name}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Download className="w-5 h-5 text-indigo-500" />
          Client Downloads
        </h2>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { name: 'Windows', icon: Wind, version: 'v2.4.1' },
            { name: 'macOS', icon: Apple, version: 'v2.3.0' },
            { name: 'Android', icon: Smartphone, version: 'v1.9.5' },
            { name: 'iOS', icon: Smartphone, version: 'App Store' },
          ].map((client) => (
            <Card key={client.name} className="flex flex-col items-center p-6 text-center hover:bg-white/5 transition-colors cursor-pointer group">
              <client.icon className="w-10 h-10 mb-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
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

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-500" />
            Client Tutorials
          </h2>
          <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Step-by-step guides</Badge>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <Tabs>
              <TabsList className="grid grid-cols-5 w-full mb-6">
                <TabsTrigger active={activeOsTab === 'windows'} onClick={() => setActiveOsTab('windows')}>Windows</TabsTrigger>
                <TabsTrigger active={activeOsTab === 'macos'} onClick={() => setActiveOsTab('macos')}>macOS</TabsTrigger>
                <TabsTrigger active={activeOsTab === 'ios'} onClick={() => setActiveOsTab('ios')}>iOS</TabsTrigger>
                <TabsTrigger active={activeOsTab === 'android'} onClick={() => setActiveOsTab('android')}>Android</TabsTrigger>
                <TabsTrigger active={activeOsTab === 'linux'} onClick={() => setActiveOsTab('linux')}>Linux</TabsTrigger>
              </TabsList>

              {Object.entries(tutorials).map(([os, clients]) => (
                <TabsContent key={os} active={activeOsTab === os} className="grid gap-8 md:grid-cols-2">
                  {clients.map((tut, idx) => (
                    <div key={idx} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                          {idx + 1}
                        </div>
                        <h3 className="font-bold text-lg">{tut.client} Setup</h3>
                      </div>
                      <div className="space-y-3">
                        {tut.steps.map((step, sIdx) => (
                          <div key={sIdx} className="flex gap-3 text-sm text-zinc-400 group">
                            <span className="text-zinc-600 font-mono mt-0.5">{sIdx + 1}.</span>
                            <p className="group-hover:text-zinc-300 transition-colors">{step}</p>
                          </div>
                        ))}
                      </div>
                      <div className="aspect-video bg-zinc-900/50 border border-white/5 rounded-xl flex items-center justify-center group cursor-help">
                        <div className="flex flex-col items-center gap-2 text-zinc-600 group-hover:text-zinc-500 transition-colors">
                          <Monitor className="w-8 h-8" />
                          <span className="text-[10px] uppercase tracking-widest font-medium">Screenshot Placeholder</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
