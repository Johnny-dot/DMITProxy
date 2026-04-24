import { describe, expect, it } from 'vitest';

import {
  parseProxyGroups,
  parseProxyNames,
  parseProxyProviders,
  summarizeClashYaml,
  validateClashSummary,
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
      - auto
      - DIRECT
      - user@example.com
  - name: auto
    type: url-test
    proxies:
      - user@example.com
rules:
  - MATCH,PROXY
`;

    expect(parseProxyNames(yaml)).toEqual(['user@example.com']);
    expect(parseProxyGroups(yaml).get('PROXY')).toEqual(['auto', 'DIRECT', 'user@example.com']);

    const summary = summarizeClashYaml(yaml);
    expect(summary.proxyGroupNodeMembers).toEqual(['user@example.com']);
    expect(summary.autoGroupNodeMembers).toEqual(['user@example.com']);
    expect(validateClashSummary(summary)).toEqual([]);
  });

  it('parses flow-style Clash proxy and group sections', () => {
    const yaml = `
proxies:
  - {name: user@example.com, type: vless, server: example.com}
proxy-groups:
  - {name: PROXY, type: select, proxies: [auto, DIRECT, user@example.com]}
  - {name: auto, type: url-test, proxies: [user@example.com]}
`;

    const summary = summarizeClashYaml(yaml);
    expect(summary.proxyNames).toEqual(['user@example.com']);
    expect(summary.proxyGroupNodeMembers).toEqual(['user@example.com']);
    expect(summary.autoGroupNodeMembers).toEqual(['user@example.com']);
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
      - auto
      - DIRECT
  - name: auto
    type: url-test
    use:
      - Provider_A023C2
    filter: .*
`;

    expect(parseProxyProviders(yaml).get('Provider_A023C2')).toEqual({
      url: 'https://sub.example.com/sub/abc',
    });

    const summary = summarizeClashYaml(yaml);
    expect(summary.proxyGroupProviders).toEqual(['Provider_A023C2']);
    expect(summary.autoGroupProviders).toEqual(['Provider_A023C2']);
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
      - auto
      - DIRECT
  - name: auto
    type: url-test
    use:
      - Provider_A023C2
`;

    expect(validateClashSummary(summarizeClashYaml(yaml))).toEqual([
      'Provider Provider_A023C2 uses a client-unusable URL: http://127.0.0.1:3001/sub/_raw/abc',
    ]);
  });
});
