import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/Tabs';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { useToast } from '@/src/components/ui/Toast';
import {
  Copy,
  QrCode,
  Download,
  Smartphone,
  Apple,
  Wind,
  ExternalLink,
  Check,
  Shield,
  Zap,
  Lock,
  Terminal,
  RefreshCw,
  Link as LinkIcon,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { cn } from '@/src/utils/cn';
import { getInbounds, Inbound } from '@/src/api/client';
import { flattenInboundClients, formatExpiry, formatTraffic } from '@/src/utils/xuiClients';
import { useI18n } from '@/src/context/I18nContext';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import { getClientDownloadLinks } from '@/src/utils/clientDownloads';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';

const STORAGE_KEY = 'prism:last-sub-id';

export function SubscriptionsPage() {
  const { toast } = useToast();
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';
  const [isLoading, setIsLoading] = useState(true);
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState('universal');
  const [activeOsTab, setActiveOsTab] = useState<'windows' | 'macos' | 'ios' | 'android'>(
    'windows',
  );
  const [subId, setSubId] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');

  const [qrOpen, setQrOpen] = useState(false);
  const [qrText, setQrText] = useState('');
  const [qrLabel, setQrLabel] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');

  // Pre-rendered QR images for the protocol share cards
  const [cardQrImages, setCardQrImages] = useState<Record<string, string>>({});

  const tutorialMap = useMemo(
    () => ({
      windows: [
        t('subscriptions.tutorial.windows1'),
        t('subscriptions.tutorial.windows2'),
        t('subscriptions.tutorial.windows3'),
      ],
      macos: [
        t('subscriptions.tutorial.macos1'),
        t('subscriptions.tutorial.macos2'),
        t('subscriptions.tutorial.macos3'),
      ],
      ios: [
        t('subscriptions.tutorial.ios1'),
        t('subscriptions.tutorial.ios2'),
        t('subscriptions.tutorial.ios3'),
      ],
      android: [
        t('subscriptions.tutorial.android1'),
        t('subscriptions.tutorial.android2'),
        t('subscriptions.tutorial.android3'),
      ],
    }),
    [t],
  );

  const linkTabs = [
    { key: 'universal', label: 'Universal' },
    { key: 'clash', label: 'Clash' },
    { key: 'v2ray', label: 'V2Ray' },
    { key: 'singbox', label: 'Singbox' },
  ] as const;

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getInbounds();
      setInbounds(data);
    } catch {
      toast(t('subscriptions.failedLoad'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, subId);
  }, [subId]);

  useEffect(() => {
    if (!qrOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQrOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [qrOpen]);

  const clients = useMemo(() => flattenInboundClients(inbounds), [inbounds]);

  const matchedClient = useMemo(() => {
    const normalized = subId.trim().toLowerCase();
    if (!normalized) return null;
    return clients.find((client) => client.subId.toLowerCase() === normalized) ?? null;
  }, [clients, subId]);

  const generatedLinks = useMemo(() => {
    if (!subId.trim()) {
      return {
        universal: '',
        clash: '',
        v2ray: '',
        singbox: '',
      };
    }
    return {
      universal: buildSubscriptionUrl(subId, 'universal'),
      clash: buildSubscriptionUrl(subId, 'clash'),
      v2ray: buildSubscriptionUrl(subId, 'v2ray'),
      singbox: buildSubscriptionUrl(subId, 'singbox'),
    };
  }, [subId]);

  const copyToClipboard = async (text: string, id: string) => {
    if (!text) {
      toast(t('subscriptions.validSubIdFirst'), 'info');
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast(t('subscriptions.copiedToClipboard'), 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openQr = async (text: string, label: string) => {
    if (!text) {
      toast(t('subscriptions.validSubIdFirst'), 'info');
      return;
    }
    setQrOpen(true);
    setQrText(text);
    setQrLabel(label);
    setQrImage('');
    setQrError('');
    setQrLoading(true);

    try {
      const image = await QRCode.toDataURL(text, {
        width: 360,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      setQrImage(image);
    } catch {
      setQrError(t('subscriptions.qrFailed'));
    } finally {
      setQrLoading(false);
    }
  };

  const openLink = (url: string, label: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    toast(t('subscriptions.opening', { label }), 'info');
  };

  // Generate QR codes for protocol cards whenever links change
  useEffect(() => {
    const entries = Object.entries(generatedLinks).filter(([, url]) => Boolean(url));
    if (entries.length === 0) {
      setCardQrImages({});
      return;
    }
    void Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const dataUrl = await QRCode.toDataURL(url, {
            width: 200,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' },
          });
          return [key, dataUrl] as const;
        } catch {
          return [key, ''] as const;
        }
      }),
    ).then((results) => {
      setCardQrImages(Object.fromEntries(results));
    });
  }, [generatedLinks]);

  const activeLink = generatedLinks[activeSubTab as keyof typeof generatedLinks] ?? '';

  return (
    <div className="space-y-10 pb-20">
      <section className="surface-card flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-7">
        <div className="space-y-3">
          <p className="section-kicker">{t('subscriptions.title')}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t('subscriptions.title')}</h1>
          <p className="max-w-3xl text-sm leading-7 text-zinc-400">{t('subscriptions.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 px-3 py-1">
            <Shield className="w-3.5 h-3.5" />
            {t('subscriptions.synced')}
          </Badge>
          <Button variant="outline" size="icon" onClick={load} disabled={isLoading}>
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-zinc-400" />
            <span>{t('subscriptions.subIdTitle')}</span>
            <InfoTooltip content={t('subscriptions.help.subId')} />
          </CardTitle>
          <CardDescription>{t('subscriptions.subIdDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
            placeholder={t('subscriptions.subIdPlaceholder')}
            className="font-mono"
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              <span>{t('subscriptions.linksTitle')}</span>
              <InfoTooltip content={t('subscriptions.help.links')} />
            </CardTitle>
            <CardDescription>{t('subscriptions.linksDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs>
              <TabsList className="grid grid-cols-4 w-full">
                {linkTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.key}
                    active={activeSubTab === tab.key}
                    onClick={() => setActiveSubTab(tab.key)}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {(Object.entries(generatedLinks) as Array<[keyof typeof generatedLinks, string]>).map(
                ([key, link]) => {
                  const keyName = String(key);
                  const tab = linkTabs.find((item) => item.key === keyName);
                  const label = tab?.label ?? keyName;
                  return (
                    <TabsContent
                      key={keyName}
                      active={activeSubTab === keyName}
                      className="space-y-4"
                    >
                      <div className="flex gap-2">
                        <Input
                          value={link || t('subscriptions.waitingSubId')}
                          readOnly
                          className="font-mono text-xs bg-zinc-900/50 border-white/5"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(link, keyName)}
                        >
                          {copiedId === keyName ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            copyToClipboard(link, `${keyName}-oneclick`);
                            toast(t('subscriptions.linkCopiedImport'), 'info');
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {t('subscriptions.oneClickImport')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => openQr(link, label)}
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          {t('subscriptions.showQr')}
                        </Button>
                      </div>
                    </TabsContent>
                  );
                },
              )}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              <span>{t('subscriptions.clientStats')}</span>
              <InfoTooltip content={t('subscriptions.help.clientStats')} />
            </CardTitle>
            <CardDescription>{t('subscriptions.resolvedFromInbounds')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : matchedClient ? (
              <>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-zinc-400 text-sm">{t('subscriptions.statUsername')}</span>
                  <span className="font-medium">{matchedClient.username}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-zinc-400 text-sm inline-flex items-center gap-1">
                    <span>{t('subscriptions.statTrafficUsed')}</span>
                    <InfoTooltip content={t('subscriptions.help.statTrafficUsed')} />
                  </span>
                  <span className="font-medium">
                    {formatTraffic(matchedClient.up + matchedClient.down)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-zinc-400 text-sm inline-flex items-center gap-1">
                    <span>{t('subscriptions.statTrafficLimit')}</span>
                    <InfoTooltip content={t('subscriptions.help.statTrafficLimit')} />
                  </span>
                  <span className="font-medium">
                    {matchedClient.totalGB > 0
                      ? formatTraffic(matchedClient.totalGB)
                      : t('common.unlimited')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-zinc-400 text-sm">{t('subscriptions.statInbound')}</span>
                  <span className="font-medium text-xs">{matchedClient.inboundRemark}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-zinc-400 text-sm">{t('subscriptions.statExpireTime')}</span>
                  <span className="text-indigo-400 font-medium text-xs">
                    {formatExpiry(matchedClient.expiryTime)}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                {subId.trim() ? t('subscriptions.statNotFound') : t('subscriptions.statInputHint')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <span>{t('subscriptions.protocolShareCards')}</span>
          <InfoTooltip content={t('subscriptions.help.protocolShareCards')} />
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              key: 'universal' as const,
              name: 'Universal',
              icon: Shield,
              color: 'text-indigo-500',
              bg: 'bg-indigo-500/10',
              link: generatedLinks.universal,
            },
            {
              key: 'v2ray' as const,
              name: 'V2Ray',
              icon: Zap,
              color: 'text-emerald-500',
              bg: 'bg-emerald-500/10',
              link: generatedLinks.v2ray,
            },
            {
              key: 'clash' as const,
              name: 'Clash',
              icon: Lock,
              color: 'text-amber-500',
              bg: 'bg-amber-500/10',
              link: generatedLinks.clash,
            },
          ].map((proto) => (
            <Card key={proto.name} className="overflow-hidden">
              <CardContent className="p-0">
                <div
                  className={cn(
                    'p-4 flex items-center justify-between border-b border-white/5',
                    proto.bg,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <proto.icon className={cn('w-4 h-4', proto.color)} />
                    <span className="font-bold text-sm tracking-wide">{proto.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] uppercase tracking-wider"
                    onClick={() => copyToClipboard(proto.link, proto.name)}
                  >
                    {copiedId === proto.name ? t('common.copied') : t('common.copyLink')}
                  </Button>
                </div>
                <div className="p-6 flex flex-col items-center justify-center bg-zinc-900/20">
                  <button
                    type="button"
                    onClick={() => openQr(proto.link, proto.name)}
                    className="w-36 h-36 rounded-xl flex items-center justify-center relative group cursor-pointer transition-opacity hover:opacity-80"
                    title={t('subscriptions.showQr')}
                  >
                    {cardQrImages[proto.key] ? (
                      <img
                        src={cardQrImages[proto.key]}
                        alt={`${proto.name} QR`}
                        className="w-full h-full rounded-lg p-1 bg-white"
                      />
                    ) : (
                      <div className="w-full h-full border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center group-hover:border-white/20 transition-colors">
                        <QrCode className="w-12 h-12 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                      </div>
                    )}
                  </button>
                  <p className="mt-3 text-[10px] text-zinc-500 uppercase tracking-widest">
                    {proto.link
                      ? t('subscriptions.scanToImport', { name: proto.name })
                      : t('subscriptions.waitingSubId')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Download className="w-5 h-5 text-indigo-500" />
          {t('subscriptions.clientDownloads')}
        </h2>
        <p className="text-sm text-zinc-400">{t('subscriptions.subtitle')}</p>
        <p className="text-xs leading-6 text-zinc-500">
          {isZh
            ? '“官方源”会打开 GitHub 或应用商店；“镜像下载”走当前站点 VPS 的缓存，适合官方源较慢时使用。'
            : 'Official opens GitHub or the app store. Mirror serves the cached package from this VPS when official sources are slow.'}
        </p>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              name: 'Windows',
              icon: Wind,
              version: 'v2rayN',
              id: 'v2rayN' as const,
              platform: 'windows' as const,
            },
            {
              name: 'macOS',
              icon: Apple,
              version: 'Clash Verge',
              id: 'clashVerge' as const,
              platform: 'macos' as const,
            },
            {
              name: 'Android',
              icon: Smartphone,
              version: 'v2rayNG',
              id: 'v2rayNG' as const,
              platform: 'android' as const,
            },
            {
              name: 'iOS',
              icon: Smartphone,
              version: 'Shadowrocket',
              id: 'shadowrocket' as const,
              platform: 'ios' as const,
            },
          ].map((client) => {
            const links = getClientDownloadLinks(client.id, client.platform);
            return (
              <Card
                key={client.name}
                className="flex flex-col items-center p-6 text-center hover:bg-white/5 transition-colors group"
              >
                <client.icon className="w-10 h-10 mb-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                <h3 className="font-semibold">{client.name}</h3>
                <p className="text-xs text-zinc-500 mb-4">{client.version}</p>
                <div className="w-full grid gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => openLink(links.github, `${client.name} Official`)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    {isZh ? '官方源' : 'Official'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    disabled={!links.vps}
                    title={
                      links.vps
                        ? isZh
                          ? '通过当前站点 VPS 缓存分发'
                          : 'Serve the cached package from this VPS'
                        : isZh
                          ? '当前平台暂不提供镜像下载'
                          : 'Mirror is not available for this platform'
                    }
                    onClick={() => openLink(links.vps, `${client.name} Mirror`)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    {isZh ? '镜像下载' : 'Mirror'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-500" />
          {t('subscriptions.quickTutorials')}
        </h2>
        <Card>
          <CardContent className="p-6 space-y-6">
            <Tabs>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger
                  active={activeOsTab === 'windows'}
                  onClick={() => setActiveOsTab('windows')}
                >
                  Windows
                </TabsTrigger>
                <TabsTrigger
                  active={activeOsTab === 'macos'}
                  onClick={() => setActiveOsTab('macos')}
                >
                  macOS
                </TabsTrigger>
                <TabsTrigger active={activeOsTab === 'ios'} onClick={() => setActiveOsTab('ios')}>
                  iOS
                </TabsTrigger>
                <TabsTrigger
                  active={activeOsTab === 'android'}
                  onClick={() => setActiveOsTab('android')}
                >
                  Android
                </TabsTrigger>
              </TabsList>

              {(Object.keys(tutorialMap) as Array<keyof typeof tutorialMap>).map((os) => (
                <TabsContent key={os} active={activeOsTab === os}>
                  <div className="space-y-3">
                    {tutorialMap[os].map((step, index) => (
                      <div key={step} className="flex gap-3 text-sm text-zinc-400">
                        <span className="text-zinc-600 font-mono">{index + 1}.</span>
                        <p>{step}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
            <div className="border-t border-white/5 pt-4 text-xs text-zinc-500">
              {t('subscriptions.tip', { name: 'Universal' })}
            </div>
          </CardContent>
        </Card>
      </div>

      {activeLink && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <p className="text-sm text-zinc-300">
              {t('subscriptions.currentLinkReady', { type: activeSubTab.toUpperCase() })}
            </p>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => copyToClipboard(activeLink, 'footer-copy')}
            >
              <Copy className="w-4 h-4" />
              {t('subscriptions.copyCurrentLink')}
            </Button>
          </CardContent>
        </Card>
      )}

      {qrOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--overlay)] p-4"
          onClick={() => setQrOpen(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') setQrOpen(false);
          }}
        >
          <Card
            className="w-full max-w-md max-h-[90vh] overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-zinc-400" />
                  {t('subscriptions.qrTitle')}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQrOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription>{t('subscriptions.qrFor', { label: qrLabel })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4 flex flex-col items-center justify-center min-h-[280px]">
                {qrLoading ? (
                  <div className="flex flex-col items-center gap-3 text-zinc-400 text-sm">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>{t('subscriptions.qrGenerating')}</span>
                  </div>
                ) : qrError ? (
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-red-400">{qrError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => copyToClipboard(qrText, 'qr-fallback-copy')}
                    >
                      <Copy className="w-4 h-4" />
                      {t('subscriptions.copyFromModal')}
                    </Button>
                  </div>
                ) : qrImage ? (
                  <img
                    src={qrImage}
                    alt={`${qrLabel} QR`}
                    className="w-full max-w-[320px] rounded-md border border-white/10"
                  />
                ) : (
                  <p className="text-sm text-zinc-500">{t('subscriptions.qrEmpty')}</p>
                )}
              </div>

              <Input
                value={qrText}
                readOnly
                className="font-mono text-xs bg-zinc-900/50 border-white/10"
              />

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => copyToClipboard(qrText, 'qr-copy')}
                >
                  <Copy className="w-4 h-4" />
                  {t('subscriptions.copyFromModal')}
                </Button>
                <Button className="gap-2" onClick={() => setQrOpen(false)}>
                  {t('subscriptions.closeQr')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
