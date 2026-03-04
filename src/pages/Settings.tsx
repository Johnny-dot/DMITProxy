import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { useToast } from '@/src/components/ui/Toast';
import { Save, Bell, Shield, Globe, Database } from 'lucide-react';

export function SettingsPage() {
  const { toast } = useToast();

  const handleSave = (section: string) => {
    toast(`${section} settings saved successfully`, 'success');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-zinc-400 mt-1">Configure system behavior and global announcements.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-500" />
                <CardTitle>General Settings</CardTitle>
              </div>
              <CardDescription>Basic configuration for the proxy panel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Site Name</label>
                <Input defaultValue="ProxyDog Admin" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Public URL</label>
                <Input defaultValue="https://panel.proxydog.io" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Support Telegram</label>
                <Input defaultValue="@proxydog_support" />
              </div>
              <Button className="gap-2" onClick={() => handleSave('General')}>
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-yellow-500" />
                <CardTitle>System Announcement</CardTitle>
              </div>
              <CardDescription>This message will be shown to all users on their dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea 
                className="w-full min-h-[150px] rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                placeholder="Enter announcement text..."
                defaultValue="Welcome to ProxyDog! We have added new high-speed nodes in Hong Kong and Japan. Enjoy your connection!"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400">Status:</span>
                  <Badge variant="success">Active</Badge>
                </div>
                <Button className="gap-2" onClick={() => handleSave('Announcement')}>
                  <Save className="w-4 h-4" />
                  Update Announcement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-500" />
                <CardTitle>Security</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => toast('Password change initiated', 'info')}>
                Change Admin Password
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => toast('2FA settings opened', 'info')}>
                Two-Factor Auth
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => toast('All sessions cleared', 'success')}>
                Clear All Sessions
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-500" />
                <CardTitle>Maintenance</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => toast('Database backup started', 'success')}>
                Backup Database
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => toast('Traffic logs cleared', 'success')}>
                Clear Traffic Logs
              </Button>
              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">System Info</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Version</span>
                    <span>v1.2.4-stable</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Uptime</span>
                    <span>12d 4h 22m</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
