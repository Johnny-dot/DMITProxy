import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export function Navbar() {
  return (
    <div className="flex items-center justify-between w-full gap-4">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-sm hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input 
            placeholder="Search users, nodes..." 
            className="pl-10 bg-zinc-900/50 border-white/5 h-9"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-zinc-400" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-zinc-950" />
        </Button>
        <div className="h-8 w-px bg-white/10 mx-1 md:mx-2" />
        <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
          <User className="w-4 h-4" />
          Profile
        </Button>
        <Button variant="outline" size="icon" className="sm:hidden">
          <User className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
