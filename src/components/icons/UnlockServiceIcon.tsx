import React, { useEffect, useState } from 'react';
import { cn } from '@/src/utils/cn';
import type { UnlockServiceId } from '@/src/types/nodeQuality';

interface UnlockServiceIconProps {
  service: UnlockServiceId;
  className?: string;
}

const OFFICIAL_ICON_SOURCES: Record<UnlockServiceId, string[]> = {
  netflix: [
    'https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png',
    'https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2023.ico',
    'https://www.netflix.com/favicon.ico',
  ],
  chatgpt: [
    'https://cdn.oaistatic.com/assets/favicon-miwirzcw.ico',
    'https://chatgpt.com/apple-touch-icon.png',
    'https://chatgpt.com/favicon.ico',
  ],
  claude: [
    'https://claude.ai/apple-touch-icon.png',
    'https://claude.ai/favicon.svg',
    'https://claude.ai/favicon.ico',
  ],
  tiktok: [
    'https://sf16-sg.tiktokcdn.com/obj/eden-sg/uvkuhyieh7lpqpbj/pwa/512x512.png',
    'https://sf16-sg.tiktokcdn.com/obj/eden-sg/uvkuhyieh7lpqpbj/pwa/384x384.png',
    'https://sf16-sg.tiktokcdn.com/obj/eden-sg/uvkuhyieh7lpqpbj/pwa/192x192.png',
    'https://www.tiktok.com/favicon.ico',
  ],
  instagram: [
    'https://static.cdninstagram.com/rsrc.php/yr/r/rzWiSjZRxk5.webp',
    'https://static.cdninstagram.com/rsrc.php/yw/r/icwX0xAk0pz.webp',
    'https://static.cdninstagram.com/rsrc.php/y4/r/QaBlI0OZiks.ico',
  ],
  spotify: [
    'https://open.spotifycdn.com/cdn/images/icons/Spotify_MWP_512.50dd387d.png',
    'https://open.spotifycdn.com/cdn/images/icons/Spotify_MWP_384.b98158a0.png',
    'https://open.spotifycdn.com/cdn/images/icons/Spotify_MWP_192.ebf939fd.png',
    'https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png',
  ],
  youtube: [
    'https://www.gstatic.com/youtube/img/web/maskable/logo_512x512.png',
    'https://www.gstatic.com/youtube/img/web/maskable/logo_192x192.png',
    'https://www.gstatic.com/youtube/img/branding/favicon/favicon_192x192_v2.png',
    'https://www.youtube.com/favicon.ico',
  ],
  disneyplus: [
    'https://static-assets.bamgrid.com/product/disneyplus/favicons/msftpwa-512x512-aurora.b544236c6734eb78083b1f4f31d6f873.png',
    'https://static-assets.bamgrid.com/product/disneyplus/favicons/msftpwa-192x192-aurora.97f08a1eb58995c81687d0cf3f953796.png',
    'https://static-assets.bamgrid.com/product/disneyplus/favicons/disPlus-favicon-180x180.7d56f648dc95f591721935193bc827cb.png',
    'https://www.disneyplus.com/favicon.ico',
  ],
  primevideo: [
    'https://m.media-amazon.com/images/G/01/digital/video/DVUI/favicons/apple-touch-icon.png',
    'https://m.media-amazon.com/images/G/01/digital/video/DVUI/favicons/apple-touch-icon-152x152.png',
    'https://m.media-amazon.com/images/G/01/digital/video/DVUI/favicons/favicon.png',
    'https://www.primevideo.com/favicon.ico',
  ],
  x: [
    'https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png',
    'https://abs.twimg.com/responsive-web/client-web/icon-svg.ea5ff4aa.svg',
    'https://x.com/favicon.ico',
  ],
};

function Wrapper({
  className,
  children,
  style,
}: {
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[9px]',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

function ClaudeAppIcon({ className }: { className?: string }) {
  return (
    <Wrapper className={cn('bg-[#d97757]', className)}>
      <svg viewBox="0 0 248 248" className="h-[72%] w-[72%] fill-white">
        <path d="M52.4285 162.873L98.7844 136.879L99.5485 134.602L98.7844 133.334H96.4921L88.7237 132.862L62.2346 132.153L39.3113 131.207L17.0249 130.026L11.4214 128.844L6.2 121.873L6.7094 118.447L11.4214 115.257L18.171 115.847L33.0711 116.911L55.485 118.447L71.6586 119.392L95.728 121.873H99.5485L100.058 120.337L98.7844 119.392L97.7656 118.447L74.5877 102.732L49.4995 86.1905L36.3823 76.62L29.3779 71.7757L25.8121 67.2858L24.2839 57.3608L30.6515 50.2716L39.3113 50.8623L41.4763 51.4531L50.2636 58.1879L68.9842 72.7209L93.4357 90.6804L97.0015 93.6343L98.4374 92.6652L98.6571 91.9801L97.0015 89.2625L83.757 65.2772L69.621 40.8192L63.2534 30.6579L61.5978 24.632C60.9565 22.1032 60.579 20.0111 60.579 17.4246L67.8381 7.49965L71.9133 6.19995L81.7193 7.49965L85.7946 11.0443L91.9074 24.9865L101.714 46.8451L116.996 76.62L121.453 85.4816L123.873 93.6343L124.764 96.1155H126.292V94.6976L127.566 77.9197L129.858 57.3608L132.15 30.8942L132.915 23.4505L136.608 14.4708L143.994 9.62643L149.725 12.344L154.437 19.0788L153.8 23.4505L150.998 41.6463L145.522 70.1215L141.957 89.2625H143.994L146.414 86.7813L156.093 74.0206L172.266 53.698L179.398 45.6635L187.803 36.802L193.152 32.5484H203.34L210.726 43.6549L207.415 55.1159L196.972 68.3492L188.312 79.5739L175.896 96.2095L168.191 109.585L168.882 110.689L170.738 110.53L198.755 104.504L213.91 101.787L231.994 98.7149L240.144 102.496L241.036 106.395L237.852 114.311L218.495 119.037L195.826 123.645L162.07 131.592L161.696 131.893L162.137 132.547L177.36 133.925L183.855 134.279H199.774L229.447 136.524L237.215 141.605L241.8 147.867L241.036 152.711L229.065 158.737L213.019 154.956L175.45 145.977L162.587 142.787H160.805V143.85L171.502 154.366L191.242 172.089L215.82 195.011L217.094 200.682L213.91 205.172L210.599 204.699L188.949 188.394L180.544 181.069L161.696 165.118H160.422V166.772L164.752 173.152L187.803 207.771L188.949 218.405L187.294 221.832L181.308 223.959L174.813 222.777L161.187 203.754L147.305 182.486L136.098 163.345L134.745 164.2L128.075 235.42L125.019 239.082L117.887 241.8L111.902 237.31L108.718 229.984L111.902 215.452L115.722 196.547L118.779 181.541L121.58 162.873L123.291 156.636L123.14 156.219L121.773 156.449L107.699 175.752L86.304 204.699L69.3663 222.777L65.291 224.431L58.2867 220.768L58.9235 214.27L62.8713 208.48L86.304 178.705L100.44 160.155L109.551 149.507L109.462 147.967L108.959 147.924L46.6977 188.512L35.6182 189.93L30.7788 185.44L31.4156 178.115L33.7079 175.752L52.4285 162.873Z" />
      </svg>
    </Wrapper>
  );
}

function FallbackIcon({ service, className }: UnlockServiceIconProps) {
  if (service === 'netflix') {
    return (
      <Wrapper className={cn('bg-[#e50914]/15 text-[#e50914]', className)}>
        <svg viewBox="0 0 24 24" className="h-[70%] w-[70%] fill-current">
          <rect x="4" y="3" width="4" height="18" rx="1" />
          <rect x="16" y="3" width="4" height="18" rx="1" />
          <polygon points="8,3 16,21 12.2,21 4.2,3" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'chatgpt') {
    return (
      <Wrapper className={cn('bg-[#10a37f]/15 text-[#10a37f]', className)}>
        <svg
          viewBox="0 0 24 24"
          className="h-[78%] w-[78%]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="12" cy="5.5" r="3" />
          <circle cx="17.2" cy="8.5" r="3" />
          <circle cx="17.2" cy="14.8" r="3" />
          <circle cx="12" cy="17.8" r="3" />
          <circle cx="6.8" cy="14.8" r="3" />
          <circle cx="6.8" cy="8.5" r="3" />
          <circle cx="12" cy="11.8" r="2.2" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'claude') {
    return (
      <Wrapper className={cn('bg-[#d97706]/15 text-[#d97706]', className)}>
        <svg viewBox="0 0 24 24" className="h-[72%] w-[72%]" fill="none">
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          <path d="M12 3.7v4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 15.7v4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M3.7 12h4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M15.7 12h4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="m6.1 6.1 3.2 3.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="m14.7 14.7 3.2 3.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="m17.9 6.1-3.2 3.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="m9.3 14.7-3.2 3.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'tiktok') {
    return (
      <Wrapper className={cn('bg-zinc-950 text-white', className)}>
        <svg
          viewBox="0 0 24 24"
          className="h-[76%] w-[76%]"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M14.3 5.2v8a3.7 3.7 0 1 1-2.8-3.6"
            stroke="#25f4ee"
            strokeWidth="2.2"
            transform="translate(0.45 0.45)"
          />
          <path
            d="M14.3 5.2c0 1.8 1.2 3.3 3 3.8"
            stroke="#fe2c55"
            strokeWidth="2.2"
            transform="translate(-0.45 -0.45)"
          />
          <path d="M14.3 5.2v8a3.7 3.7 0 1 1-2.8-3.6" stroke="currentColor" strokeWidth="2.2" />
          <path d="M14.3 5.2c0 1.8 1.2 3.3 3 3.8" stroke="currentColor" strokeWidth="2.2" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'instagram') {
    return (
      <Wrapper
        className={className}
        style={{
          background:
            'radial-gradient(circle at 30% 110%, #fdf497 0%, #fdf497 8%, #fd5949 40%, #d6249f 68%, #285AEB 100%)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[68%] w-[68%]"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
        >
          <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="17.4" cy="6.8" r="1.1" fill="#fff" stroke="none" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'youtube') {
    return (
      <Wrapper className={cn('bg-[#ff0033]/15 text-[#ff0033]', className)}>
        <svg viewBox="0 0 24 24" className="h-[76%] w-[76%]" fill="none">
          <rect x="4" y="6.2" width="16" height="11.6" rx="3.2" fill="currentColor" />
          <polygon points="10.2,9.2 15.6,12 10.2,14.8" fill="#fff" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'disneyplus') {
    return (
      <Wrapper className={cn('bg-[#113ccf]/15 text-[#7dd3fc]', className)}>
        <svg
          viewBox="0 0 24 24"
          className="h-[76%] w-[76%]"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5.6 10.8c1.9-3.5 5.3-5.3 10.3-5.3" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M7.1 15.6V9.8h2.3c1.8 0 2.9 1.1 2.9 2.9s-1.1 2.9-2.9 2.9z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M13.2 15.6V9.8h4.3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.2 12.7h3.3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.2 15.6h4.4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M18.2 7.3l.01 0" stroke="#fff" strokeWidth="2.2" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'primevideo') {
    return (
      <Wrapper className={cn('bg-[#00a8e1]/15 text-[#00a8e1]', className)}>
        <svg
          viewBox="0 0 24 24"
          className="h-[76%] w-[76%]"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M6.2 15.9c1.9 1.1 3.9 1.7 6.2 1.7 2 0 3.9-.5 5.6-1.5"
            stroke="currentColor"
            strokeWidth="1.9"
          />
          <path d="M15.6 16.3l2.8-.2-.8 2.6" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M8 13.2v-3.1h1.7c1.2 0 1.9.6 1.9 1.6 0 1-.7 1.5-1.9 1.5z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M13.1 13.2v-3.1h2.9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.1 11.6h2.2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </Wrapper>
    );
  }

  if (service === 'x') {
    return (
      <Wrapper className={cn('bg-zinc-950 text-white', className)}>
        <svg viewBox="0 0 24 24" className="h-[72%] w-[72%]" fill="currentColor">
          <path d="M6.3 5h3.2l3 4.4L16.4 5H18l-4.7 5.5L18.9 19h-3.2l-3.4-5-4.2 5H6.5l5.1-6-5.3-8z" />
        </svg>
      </Wrapper>
    );
  }

  return (
    <Wrapper className={cn('bg-[#1ed760]/15 text-[#1ed760]', className)}>
      <svg
        viewBox="0 0 24 24"
        className="h-[74%] w-[74%]"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      >
        <circle cx="12" cy="12" r="8.2" />
        <path d="M7.4 9.3c2.7-0.7 5.9-0.6 8.9 0.5" />
        <path d="M8 12c2.3-0.5 5-0.4 7.6 0.4" />
        <path d="M8.7 14.8c1.9-0.3 4-0.2 6 0.4" />
      </svg>
    </Wrapper>
  );
}

export function UnlockServiceIcon({ service, className }: UnlockServiceIconProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = OFFICIAL_ICON_SOURCES[service];
  const src = sources[sourceIndex];

  useEffect(() => {
    setSourceIndex(0);
  }, [service]);

  if (service === 'claude') {
    return <ClaudeAppIcon className={className} />;
  }

  if (src) {
    return (
      <Wrapper className={cn('bg-transparent', className)}>
        <img
          key={`${service}-${sourceIndex}`}
          src={src}
          alt=""
          className="h-8 w-8 rounded-[8px] object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setSourceIndex((current) => current + 1)}
        />
      </Wrapper>
    );
  }

  return <FallbackIcon service={service} className={className} />;
}
