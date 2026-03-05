export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  createdAt: number;
  read: boolean;
  actionPath?: string;
  actionLabel?: string;
}
