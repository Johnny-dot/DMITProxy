import { describe, expect, it } from 'vitest';

import {
  parseProxyGroups,
  parseProxyNames,
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

  it('flags the exact provider-only failure mode', () => {
    const yaml = `
proxy-providers:
  nodes:
    type: http
proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - auto
      - DIRECT
  - name: auto
    type: url-test
    use:
      - nodes
`;

    expect(validateClashSummary(summarizeClashYaml(yaml))).toEqual([
      'No inline nodes were found in the top-level proxies section.',
      'The PROXY group does not include any top-level node names.',
      'The auto group is missing or has no proxies list.',
      'The auto group does not include any top-level node names.',
    ]);
  });
});
