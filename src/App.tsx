import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { NodesPage } from './pages/Nodes';
import { OnlineUsersPage } from './pages/OnlineUsers';
import { TrafficPage } from './pages/Traffic';
import { SubscriptionsPage } from './pages/Subscriptions';
import { SettingsPage } from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="nodes" element={<NodesPage />} />
          <Route path="online" element={<OnlineUsersPage />} />
          <Route path="traffic" element={<TrafficPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
