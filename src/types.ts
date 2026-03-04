export interface User {
  id: string;
  username: string;
  uuid: string;
  trafficUsed: number; // in bytes
  trafficLimit: number; // in bytes
  deviceLimit: number;
  expireTime: string;
  status: 'active' | 'disabled' | 'expired';
}

export interface Node {
  id: string;
  name: string;
  location: string;
  latency: number;
  status: 'online' | 'offline';
  load: number; // percentage
}

export interface OnlineUser {
  id: string;
  username: string;
  ip: string;
  nodeName: string;
  connectionCount: number;
  duration: string;
}

export interface TrafficData {
  timestamp: string;
  upload: number;
  download: number;
}

export interface OnlineUsersData {
  timestamp: string;
  count: number;
}
