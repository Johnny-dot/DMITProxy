import { User, Node, OnlineUser, TrafficData, OnlineUsersData, Inbound, ServerStatus } from './types';

export const mockInbounds: Inbound[] = [
  { id: 1, remark: 'US-Premium-VLESS', protocol: 'VLESS', port: 443, totalTraffic: 1024 * 1024 * 1024 * 1024, usedTraffic: 450 * 1024 * 1024 * 1024, clientCount: 12, status: 'enabled' },
  { id: 2, remark: 'HK-Gaming-Trojan', protocol: 'Trojan', port: 8443, totalTraffic: 500 * 1024 * 1024 * 1024, usedTraffic: 120 * 1024 * 1024 * 1024, clientCount: 8, status: 'enabled' },
  { id: 3, remark: 'JP-Standard-VMess', protocol: 'VMess', port: 10086, totalTraffic: 0, usedTraffic: 89 * 1024 * 1024 * 1024, clientCount: 5, status: 'enabled' },
  { id: 4, remark: 'SG-Shadowsocks', protocol: 'Shadowsocks', port: 20000, totalTraffic: 200 * 1024 * 1024 * 1024, usedTraffic: 195 * 1024 * 1024 * 1024, clientCount: 3, status: 'disabled' },
];

export const mockServerStatus: ServerStatus = {
  cpu: 12.5,
  ram: { used: 1.2 * 1024 * 1024 * 1024, total: 4 * 1024 * 1024 * 1024 },
  disk: { used: 15 * 1024 * 1024 * 1024, total: 50 * 1024 * 1024 * 1024 },
  xrayStatus: 'running',
  network: { up: 1.2 * 1024 * 1024, down: 5.4 * 1024 * 1024 },
  uptime: '12d 4h 22m',
};

export const mockUsers: User[] = [
  { id: '1', username: 'alice_vpn', uuid: '550e8400-e29b-41d4-a716-446655440000', trafficUsed: 45 * 1024 * 1024 * 1024, trafficLimit: 100 * 1024 * 1024 * 1024, deviceLimit: 3, expireTime: '2025-12-31', status: 'active' },
  { id: '2', username: 'bob_dev', uuid: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', trafficUsed: 120 * 1024 * 1024 * 1024, trafficLimit: 200 * 1024 * 1024 * 1024, deviceLimit: 5, expireTime: '2025-06-15', status: 'active' },
  { id: '3', username: 'charlie_test', uuid: 'e4e3e2e1-d1c1-b1a1-a1b1-c1d1e1f1g1h1', trafficUsed: 10 * 1024 * 1024 * 1024, trafficLimit: 50 * 1024 * 1024 * 1024, deviceLimit: 2, expireTime: '2024-03-01', status: 'expired' },
  { id: '4', username: 'david_pro', uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', trafficUsed: 450 * 1024 * 1024 * 1024, trafficLimit: 500 * 1024 * 1024 * 1024, deviceLimit: 10, expireTime: '2026-01-01', status: 'active' },
  { id: '5', username: 'eve_user', uuid: 'd9b2d63d-ce30-49ad-a281-7845a05f2941', trafficUsed: 5 * 1024 * 1024 * 1024, trafficLimit: 100 * 1024 * 1024 * 1024, deviceLimit: 3, expireTime: '2025-08-20', status: 'disabled' },
];

export const mockNodes: Node[] = [
  { id: '1', name: 'US-West-01', location: 'Los Angeles, USA', latency: 120, status: 'online', load: 45 },
  { id: '2', name: 'HK-CN2-01', location: 'Hong Kong, China', latency: 45, status: 'online', load: 78 },
  { id: '3', name: 'JP-Tokyo-02', location: 'Tokyo, Japan', latency: 65, status: 'online', load: 32 },
  { id: '4', name: 'SG-Premium-01', location: 'Singapore', latency: 85, status: 'offline', load: 0 },
  { id: '5', name: 'UK-London-01', location: 'London, UK', latency: 180, status: 'online', load: 15 },
];

export const mockOnlineUsers: OnlineUser[] = [
  { id: '1', username: 'alice_vpn', ip: '192.168.1.5', nodeName: 'HK-CN2-01', connectionCount: 2, duration: '02:45:12' },
  { id: '2', username: 'bob_dev', ip: '10.0.0.42', nodeName: 'US-West-01', connectionCount: 1, duration: '00:15:30' },
  { id: '3', username: 'david_pro', ip: '172.16.0.10', nodeName: 'JP-Tokyo-02', connectionCount: 4, duration: '12:20:05' },
];

export const mockTrafficHistory: TrafficData[] = Array.from({ length: 24 }, (_, i) => ({
  timestamp: `${i}:00`,
  upload: Math.floor(Math.random() * 500) + 100,
  download: Math.floor(Math.random() * 2000) + 500,
}));

export const mockOnlineUsersHistory: OnlineUsersData[] = Array.from({ length: 24 }, (_, i) => ({
  timestamp: `${i}:00`,
  count: Math.floor(Math.random() * 30) + 10,
}));
