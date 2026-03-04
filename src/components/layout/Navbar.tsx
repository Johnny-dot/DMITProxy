import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export function Navbar() {
  return (
    <header className="h-16 border-b border-white/10 bg-zinc-950/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-50">
      <div className="flex items-center gap-4 w-1/3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input 
            placeholder="Search users, nodes..." 
            className="pl-10 bg-zinc-900/50 border-white/5 h-9"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-zinc-400" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-zinc-950" />
        </Button>
        <div className="h-8 w-px bg-white/10 mx-2" />
        <Button variant="outline" size="sm" className="gap-2">
          <User className="w-4 h-4" />
          Profile
        </Button>
      </div>
    </header>
  );
}
