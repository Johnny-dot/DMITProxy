export function buildSubscriptionProfileTitleHeader(title: string): string {
  return `base64:${Buffer.from(title, 'utf8').toString('base64')}`;
}
