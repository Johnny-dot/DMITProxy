import { describe, expect, it } from 'vitest';

import { renderClashInlineSubscription } from './clash-inline.js';

describe('renderClashInlineSubscription', () => {
  it('renders VLESS Reality links as inline Clash proxies without proxy-providers', () => {
    const yaml = renderClashInlineSubscription(
      [
        'vless://00000000-0000-4000-8000-000000000000@example.com:443?security=reality&sni=www.example.com&fp=chrome&pbk=public-key&sid=abcd&type=tcp&flow=xtls-rprx-vision#User',
        'vless://00000000-0000-4000-8000-000000000000@example.com:443?security=reality&sni=www.example.com&fp=chrome&pbk=public-key&sid=abcd&type=tcp&flow=xtls-rprx-vision&prism_info=prism-info-1#Info',
      ].join('\n'),
    );

    expect(yaml).toContain('proxies:');
    expect(yaml).not.toContain('proxy-providers:');
    expect(yaml).toContain('type: "vless"');
    expect(yaml).toContain('name: "User"');
    expect(yaml).toContain('network: "tcp"');
    expect(yaml).toContain('flow: "xtls-rprx-vision"');
    expect(yaml).toContain('client-fingerprint: "chrome"');
    expect(yaml).toContain('reality-opts:');
    expect(yaml).toContain('public-key: "public-key"');
    expect(yaml).toContain('short-id: "abcd"');
    expect(yaml).toContain('- "User"');
    expect(yaml).toContain('- "Info"');
  });

  it('renders vmess and shadowsocks links into the same PROXY group', () => {
    const vmessConfig = {
      v: '2',
      ps: 'VMess Node',
      add: 'vmess.example.com',
      port: 443,
      id: '00000000-0000-4000-8000-000000000000',
      aid: 0,
      scy: 'auto',
      net: 'ws',
      tls: 'tls',
      sni: 'vmess.example.com',
      path: '/ws',
      host: 'cdn.example.com',
    };
    const vmess = `vmess://${Buffer.from(JSON.stringify(vmessConfig)).toString('base64')}`;
    const ss = `ss://${Buffer.from('aes-256-gcm:secret').toString(
      'base64',
    )}@ss.example.com:8388#SS%20Node`;

    const yaml = renderClashInlineSubscription(`${vmess}\n${ss}`);

    expect(yaml).toContain('name: "VMess Node"');
    expect(yaml).toContain('type: "vmess"');
    expect(yaml).toContain('ws-opts:');
    expect(yaml).toContain('Host: "cdn.example.com"');
    expect(yaml).toContain('name: "SS Node"');
    expect(yaml).toContain('type: "ss"');
    expect(yaml).toContain('cipher: "aes-256-gcm"');
    expect(yaml).toContain('- "VMess Node"');
    expect(yaml).toContain('- "SS Node"');
  });

  it('decodes legacy base64-wrapped VLESS authority links', () => {
    const encodedAuthority = Buffer.from(
      'none:adf8362f-f4cc-40b7-bf6c-3d326617ae74@168.138.179.100:2096',
    ).toString('base64url');
    const yaml = renderClashInlineSubscription(
      `vless://${encodedAuthority}?remarks=SG-Reality&tls=1&peer=www.netflix.com&xtls=2&pbk=public-key&sid=short-id#Shared`,
    );

    expect(yaml).toContain('name: "Shared"');
    expect(yaml).toContain('server: "168.138.179.100"');
    expect(yaml).toContain('port: 2096');
    expect(yaml).toContain('uuid: "adf8362f-f4cc-40b7-bf6c-3d326617ae74"');
    expect(yaml).toContain('network: "tcp"');
    expect(yaml).toContain('servername: "www.netflix.com"');
    expect(yaml).toContain('flow: "xtls-rprx-vision"');
    expect(yaml).toContain('public-key: "public-key"');
    expect(yaml).toContain('short-id: "short-id"');
  });
});
