import type { NewsTopicId } from '@/src/types/news';

export interface TopicTone {
  chipClassName: string;
  avatarClassName: string;
  iconClassName: string;
  textCoverStyle: string;
}

export const TOPIC_TONES: Record<NewsTopicId, TopicTone> = {
  markets: {
    chipClassName:
      'border border-[#d4ead7] bg-[#edf9ef] text-[#24533a] dark:border-[#345842] dark:bg-[#13251c] dark:text-[#9fe0c2]',
    avatarClassName:
      'border border-[#d5ead9] bg-[#eaf8ee] text-[#295a3e] dark:border-[#2d463c] dark:bg-[#11241d] dark:text-[#9fe0c2]',
    iconClassName: 'text-[#2a5b3f] dark:text-[#9fe0c2]',
    textCoverStyle:
      'linear-gradient(180deg, rgba(242, 251, 244, 0.98) 0%, rgba(224, 245, 230, 0.98) 100%)',
  },
  macro: {
    chipClassName:
      'border border-[#f0dfc9] bg-[#fff6ea] text-[#8e5a23] dark:border-[#6b5334] dark:bg-[#261b13] dark:text-[#f3c18a]',
    avatarClassName:
      'border border-[#f2e1ca] bg-[#fff3e4] text-[#945d22] dark:border-[#5a4930] dark:bg-[#271b13] dark:text-[#f3c18a]',
    iconClassName: 'text-[#945d22] dark:text-[#f3c18a]',
    textCoverStyle:
      'linear-gradient(180deg, rgba(255, 248, 238, 0.98) 0%, rgba(255, 236, 210, 0.98) 100%)',
  },
  world: {
    chipClassName:
      'border border-[#ecd4cf] bg-[#fff2ef] text-[#8a4438] dark:border-[#75433c] dark:bg-[#271715] dark:text-[#f3b2a6]',
    avatarClassName:
      'border border-[#efd5cf] bg-[#fff1ee] text-[#8e4639] dark:border-[#673732] dark:bg-[#241513] dark:text-[#f3b2a6]',
    iconClassName: 'text-[#8e4639] dark:text-[#f3b2a6]',
    textCoverStyle:
      'linear-gradient(180deg, rgba(255, 245, 242, 0.98) 0%, rgba(251, 229, 223, 0.98) 100%)',
  },
  technology: {
    chipClassName:
      'border border-[#d7e6fb] bg-[#eef5ff] text-[#29527e] dark:border-[#3c5d84] dark:bg-[#122030] dark:text-[#a9cdf5]',
    avatarClassName:
      'border border-[#d7e7fb] bg-[#eef5ff] text-[#2b5581] dark:border-[#314866] dark:bg-[#121d2a] dark:text-[#a9cdf5]',
    iconClassName: 'text-[#2b5581] dark:text-[#a9cdf5]',
    textCoverStyle:
      'linear-gradient(180deg, rgba(241, 247, 255, 0.98) 0%, rgba(224, 236, 252, 0.98) 100%)',
  },
  aiTalks: {
    chipClassName:
      'border border-[#f1d5dd] bg-[#fff0f4] text-[#943d56] dark:border-[#844156] dark:bg-[#29131c] dark:text-[#ffb3c5]',
    avatarClassName:
      'border border-[#f2d8df] bg-[#fff0f4] text-[#973e57] dark:border-[#6a3041] dark:bg-[#26121a] dark:text-[#ffb3c5]',
    iconClassName: 'text-[#973e57] dark:text-[#ffb3c5]',
    textCoverStyle:
      'linear-gradient(180deg, rgba(255, 242, 246, 0.98) 0%, rgba(255, 225, 234, 0.98) 100%)',
  },
  crypto: {
    chipClassName:
      'border border-[#dde9c6] bg-[#f5fbe8] text-[#506c25] dark:border-[#4c6f56] dark:bg-[#16231a] dark:text-[#bde6a1]',
    avatarClassName:
      'border border-[#dfeacc] bg-[#f4fae8] text-[#567125] dark:border-[#3f5a47] dark:bg-[#142018] dark:text-[#bde6a1]',
    iconClassName: 'text-[#567125] dark:text-[#bde6a1]',
    textCoverStyle:
      'linear-gradient(180deg, rgba(247, 252, 235, 0.98) 0%, rgba(232, 245, 210, 0.98) 100%)',
  },
};

export function getAvatarInitials(value: string) {
  return value
    .split(/[\s/._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatCompactCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value);
}

export function formatNewsDateTime(value: number | null, locale: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
