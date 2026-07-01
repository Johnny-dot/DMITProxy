import { describe, expect, it, vi } from 'vitest';

import {
  parseProxyGroups,
  parseProxyNames,
  parseProxyProviders,
  summarizeClashYaml,
  validateClashSummary,
  validateProxyProviderReachability,
} from './check-subconverter-clash.mjs';

describe('check-subconverter-clash', () => {
  it('parses block-style Clash proxy and group sections', () => {
    const yaml = `
port: 7890
proxies:
  - name: user@example.com
    type: vless
    server: example.com
proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - DIRECT
      - user@example.com
rules:
  - MATCH,PROXY
`;

    expect(parseProxyNames(yaml)).toEqual(['user@example.com']);
    expect(parseProxyGroups(yaml).get('PROXY')).toEqual(['DIRECT', 'user@example.com']);

    const summary = summarizeClashYaml(yaml);
    expect(summary.proxyGroupNodeMembers).toEqual(['user@example.com']);
    expect(validateClashSummary(summary)).toEqual([]);
  });

  it('parses flow-style Clash proxy and group sections', () => {
    const yaml = `
proxies:
  - {name: user@example.com, type: vless, server: example.com}
proxy-groups:
  - {name: PROXY, type: select, proxies: [DIRECT, user@example.com]}
`;

    const summary = summarizeClashYaml(yaml);
    expect(summary.proxyNames).toEqual(['user@example.com']);
    expect(summary.proxyGroupNodeMembers).toEqual(['user@example.com']);
  });

  it('accepts public provider-style Clash output', () => {
    const yaml = `
proxy-providers:
  Provider_A023C2:
    type: http
    url: https://sub.example.com/sub/abc
    interval: 3600
    path: ./providers/Provider_A023C2.yaml
proxy-groups:
  - name: PROXY
    type: select
    use:
      - Provider_A023C2
    filter: .*
    proxies:
      - DIRECT
`;

    expect(parseProxyProviders(yaml).get('Provider_A023C2')).toEqual({
      url: 'https://sub.example.com/sub/abc',
    });

    const summary = summarizeClashYaml(yaml);
    expect(summary.proxyGroupProviders).toEqual(['Provider_A023C2']);
    expect(validateClashSummary(summary)).toEqual([]);
  });

  it('flags the client-unusable loopback provider failure mode', () => {
    const yaml = `
proxy-providers:
  Provider_A023C2:
    type: http
    url: http://127.0.0.1:3001/sub/_raw/abc
proxy-groups:
  - name: PROXY
    type: select
    use:
      - Provider_A023C2
    proxies:
      - DIRECT
`;

    expect(validateClashSummary(summarizeClashYaml(yaml))).toEqual([
      'Provider Provider_A023C2 uses a client-unusable URL: http://127.0.0.1:3001/sub/_raw/abc',
    ]);
  });

  it('does not confuse provider url with nested health-check url', () => {
    const yaml = `
proxy-providers:
  Provider_A023C2:
    type: http
    url: http://127.0.0.1:3001/sub/abc
    interval: 3600
    path: ./providers/Provider_A023C2.yaml
    health-check:
      enable: true
      url: https://cp.cloudflare.com/generate_204
      interval: 300
proxy-groups:
  - name: PROXY
    type: select
    use:
      - Provider_A023C2
    proxies:
      - DIRECT
`;

    expect(parseProxyProviders(yaml).get('Provider_A023C2')).toEqual({
      url: 'http://127.0.0.1:3001/sub/abc',
    });

    expect(validateClashSummary(summarizeClashYaml(yaml))).toEqual([
      'Provider Provider_A023C2 uses a client-unusable URL: http://127.0.0.1:3001/sub/abc',
    ]);
  });

  it('fetches provider urls and ignores nested health-check urls during reachability checks', async () => {
    const yaml = `
proxy-providers:
  Provider_A023C2:
    type: http
    url: http://154.17.12.1:2096/a7k2mxp9qw3z/abc
    interval: 3600
    path: ./providers/Provider_A023C2.yaml
    health-check:
      enable: true
      url: https://cp.cloudflare.com/generate_204
      interval: 300
proxy-groups:
  - name: PROXY
    type: select
    use:
      - Provider_A023C2
    proxies:
      - DIRECT
`;
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'http://154.17.12.1:2096/a7k2mxp9qw3z/abc') {
        throw new Error('Unsupported HTTP version');
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    await expect(
      validateProxyProviderReachability(summarizeClashYaml(yaml), fetchImpl),
    ).resolves.toEqual(['Provider Provider_A023C2 is not reachable: Unsupported HTTP version']);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://154.17.12.1:2096/a7k2mxp9qw3z/abc',
      expect.any(Object),
    );
  });

  it('rejects reachable provider payloads with base64 subscription links', async () => {
    const yaml = `
proxy-providers:
  Provider_A023C2:
    type: http
    url: https://sub.example.com/sub/abc
proxy-groups:
  - name: PROXY
    type: select
    use:
      - Provider_A023C2
    proxies:
      - DIRECT
`;
    const body = Buffer.from('vless://example.com#node').toString('base64');
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => body,
    }));

    await expect(
      validateProxyProviderReachability(summarizeClashYaml(yaml), fetchImpl),
    ).resolves.toEqual([
      'Provider Provider_A023C2 returned raw protocol links instead of Clash provider YAML',
    ]);
  });
});
