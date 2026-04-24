#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3001';
const REQUEST_TIMEOUT_MS = 30_000;

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function stripQuotes(value) {
  const trimmed = String(value ?? '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineList(value) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^\[(.*)\]$/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((item) => stripQuotes(item))
    .filter(Boolean);
}

function parseFlowValue(line, key) {
  const match = line.match(
    new RegExp(`(?:^|[,\\{])\\s*${key}\\s*:\\s*(\\[[^\\]]*\\]|"[^"]*"|'[^']*'|[^,\\}]+)`),
  );
  return match ? stripQuotes(match[1]) : '';
}

function getTopLevelSectionLines(text, sectionName) {
  const lines = text.split(/\r?\n/);
  const sectionStart = new RegExp(`^${sectionName}:\\s*(?:#.*)?$`);
  const nextTopLevel = /^[A-Za-z0-9_-]+:\s*(?:#.*)?$/;
  const start = lines.findIndex((line) => sectionStart.test(line));
  if (start < 0) return [];

  const sectionLines = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (nextTopLevel.test(line)) break;
    sectionLines.push(line);
  }
  return sectionLines;
}

export function parseProxyNames(text) {
  const lines = getTopLevelSectionLines(text, 'proxies');
  const names = [];

  for (const line of lines) {
    const blockMatch = line.match(/^\s*-\s+name:\s*(.+?)\s*$/);
    if (blockMatch) {
      names.push(stripQuotes(blockMatch[1]));
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('- {') || trimmed.startsWith('-{')) {
      const name = parseFlowValue(trimmed, 'name');
      if (name) names.push(name);
    }
  }

  return names;
}

export function parseProxyGroups(text) {
  const groupDetails = parseProxyGroupDetails(text);
  return new Map(
    Array.from(groupDetails.entries()).map(([name, details]) => [name, details.proxies]),
  );
}

export function parseProxyGroupDetails(text) {
  const lines = getTopLevelSectionLines(text, 'proxy-groups');
  const groups = new Map();
  let currentName = '';
  let readingList = '';

  for (const line of lines) {
    const flowLine = line.trim();
    if (flowLine.startsWith('- {') || flowLine.startsWith('-{')) {
      const name = parseFlowValue(flowLine, 'name');
      const proxies = parseInlineList(parseFlowValue(flowLine, 'proxies'));
      const use = parseInlineList(parseFlowValue(flowLine, 'use'));
      if (name) groups.set(name, { proxies, use });
      currentName = '';
      readingList = '';
      continue;
    }

    const groupMatch = line.match(/^\s*-\s+name:\s*(.+?)\s*$/);
    if (groupMatch) {
      currentName = stripQuotes(groupMatch[1]);
      groups.set(currentName, { proxies: [], use: [] });
      readingList = '';
      continue;
    }

    const inlineMembersMatch = line.match(/^\s+proxies:\s*(\[.*\])\s*$/);
    if (inlineMembersMatch && currentName) {
      const details = groups.get(currentName) ?? { proxies: [], use: [] };
      groups.set(currentName, { ...details, proxies: parseInlineList(inlineMembersMatch[1]) });
      readingList = '';
      continue;
    }

    if (/^\s+proxies:\s*$/.test(line) && currentName) {
      readingList = 'proxies';
      continue;
    }

    const inlineUseMatch = line.match(/^\s+use:\s*(\[.*\])\s*$/);
    if (inlineUseMatch && currentName) {
      const details = groups.get(currentName) ?? { proxies: [], use: [] };
      groups.set(currentName, { ...details, use: parseInlineList(inlineUseMatch[1]) });
      readingList = '';
      continue;
    }

    if (/^\s+use:\s*$/.test(line) && currentName) {
      readingList = 'use';
      continue;
    }

    if (readingList && currentName) {
      const memberMatch = line.match(/^\s*-\s*(.+?)\s*$/);
      if (memberMatch) {
        const details = groups.get(currentName) ?? { proxies: [], use: [] };
        const values = details[readingList] ?? [];
        values.push(stripQuotes(memberMatch[1]));
        groups.set(currentName, { ...details, [readingList]: values });
        continue;
      }

      if (/^\s+\S/.test(line)) {
        readingList = '';
      }
    }
  }

  return groups;
}

export function parseProxyProviders(text) {
  const lines = getTopLevelSectionLines(text, 'proxy-providers');
  const providers = new Map();
  let currentName = '';

  for (const line of lines) {
    const providerMatch = line.match(/^\s{2}([A-Za-z0-9_.-]+):\s*$/);
    if (providerMatch) {
      currentName = providerMatch[1];
      providers.set(currentName, { url: '' });
      continue;
    }

    if (currentName) {
      const urlMatch = line.match(/^\s+url:\s*(.+?)\s*$/);
      if (urlMatch) {
        providers.set(currentName, { url: stripQuotes(urlMatch[1]) });
      }
    }
  }

  return providers;
}

function isClientUnusableProviderUrl(value) {
  if (!value) return true;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase();
  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '::1' ||
    parsed.pathname.includes('/sub/_raw/')
  );
}

export function summarizeClashYaml(text) {
  const proxyNames = parseProxyNames(text);
  const groupDetails = parseProxyGroupDetails(text);
  const providers = parseProxyProviders(text);
  const proxyGroup = groupDetails.get('PROXY') ?? { proxies: [], use: [] };
  const autoGroup = groupDetails.get('auto') ?? { proxies: [], use: [] };
  const proxyGroupMembers = proxyGroup.proxies;
  const autoGroupMembers = autoGroup.proxies;
  const providerNames = new Set(providers.keys());
  const proxyNameSet = new Set(proxyNames);
  const proxyGroupNodeMembers = proxyGroupMembers.filter((name) => proxyNameSet.has(name));
  const autoGroupNodeMembers = autoGroupMembers.filter((name) => proxyNameSet.has(name));
  const proxyGroupProviders = proxyGroup.use.filter((name) => providerNames.has(name));
  const autoGroupProviders = autoGroup.use.filter((name) => providerNames.has(name));
  const providerEntries = Array.from(providers.entries()).map(([name, provider]) => ({
    name,
    url: provider.url,
  }));

  return {
    proxyNames,
    providerEntries,
    groupNames: Array.from(groupDetails.keys()),
    proxyGroupMembers,
    autoGroupMembers,
    proxyGroupNodeMembers,
    autoGroupNodeMembers,
    proxyGroupProviders,
    autoGroupProviders,
  };
}

function previewList(values, limit = 8) {
  if (values.length === 0) return '(none)';
  const head = values.slice(0, limit).join(', ');
  return values.length > limit ? `${head}, ... +${values.length - limit}` : head;
}

function buildReport(summary) {
  return [
    `proxies count: ${summary.proxyNames.length}`,
    `proxy names: ${previewList(summary.proxyNames)}`,
    `proxy-groups: ${previewList(summary.groupNames)}`,
    `proxy-providers: ${previewList(summary.providerEntries.map((provider) => provider.name))}`,
    `provider urls: ${previewList(summary.providerEntries.map((provider) => provider.url))}`,
    `PROXY members: ${previewList(summary.proxyGroupMembers)}`,
    `PROXY node members: ${previewList(summary.proxyGroupNodeMembers)}`,
    `PROXY providers: ${previewList(summary.proxyGroupProviders)}`,
    `auto node members: ${previewList(summary.autoGroupNodeMembers)}`,
    `auto providers: ${previewList(summary.autoGroupProviders)}`,
  ].join('\n');
}

export function validateClashSummary(summary) {
  const errors = [];
  const hasInlineNodes =
    summary.proxyNames.length > 0 &&
    summary.proxyGroupNodeMembers.length > 0 &&
    summary.autoGroupNodeMembers.length > 0;
  const hasProviderNodes =
    summary.providerEntries.length > 0 &&
    summary.proxyGroupProviders.length > 0 &&
    summary.autoGroupProviders.length > 0;

  if (hasInlineNodes) return errors;

  if (hasProviderNodes) {
    for (const provider of summary.providerEntries) {
      if (isClientUnusableProviderUrl(provider.url)) {
        errors.push(
          `Provider ${provider.name} uses a client-unusable URL: ${provider.url || '(empty)'}`,
        );
      }
    }
    return errors;
  }

  if (summary.proxyNames.length === 0) {
    errors.push('No inline nodes were found in the top-level proxies section.');
  }
  if (summary.providerEntries.length === 0) {
    errors.push('No proxy-provider entries were found.');
  }
  if (summary.proxyGroupMembers.length === 0) {
    errors.push('The PROXY group is missing or has no proxies list.');
  }
  if (summary.proxyGroupNodeMembers.length === 0) {
    errors.push('The PROXY group does not include any top-level node names.');
  }
  if (summary.proxyGroupProviders.length === 0) {
    errors.push('The PROXY group does not use any defined proxy-provider.');
  }
  if (summary.autoGroupMembers.length === 0) {
    errors.push('The auto group is missing or has no proxies list.');
  }
  if (summary.autoGroupNodeMembers.length === 0) {
    errors.push('The auto group does not include any top-level node names.');
  }
  if (summary.autoGroupProviders.length === 0) {
    errors.push('The auto group does not use any defined proxy-provider.');
  }

  return errors;
}

async function main() {
  const [subId, baseUrlArg] = process.argv.slice(2);
  if (!subId || subId === '-h' || subId === '--help') {
    console.error(
      [
        'Usage: node scripts/check-subconverter-clash.mjs <subId> [baseUrl]',
        '',
        `baseUrl defaults to ${DEFAULT_BASE_URL}. Run this on the VPS after deploy.`,
      ].join('\n'),
    );
    process.exit(subId ? 0 : 2);
  }

  const baseUrl = normalizeBaseUrl(
    baseUrlArg || process.env.SUBCONVERTER_CHECK_BASE_URL || DEFAULT_BASE_URL,
  );
  const url = `${baseUrl}/sub/${encodeURIComponent(subId)}?flag=clash`;
  console.log(`[check-subconverter-clash] GET ${url}`);

  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body = await response.text();
  console.log(
    `[check-subconverter-clash] status=${response.status} content-type=${response.headers.get('content-type') ?? '(none)'}`,
  );

  if (!response.ok) {
    console.error(body.slice(0, 1000));
    process.exit(1);
  }

  const summary = summarizeClashYaml(body);
  console.log(buildReport(summary));

  const errors = validateClashSummary(summary);
  if (errors.length > 0) {
    for (const error of errors) console.error(`[check-subconverter-clash] FAIL: ${error}`);
    process.exit(1);
  }

  console.log(
    '[check-subconverter-clash] OK: nodes are inline or reachable through public providers.',
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[check-subconverter-clash] ERROR: ${message}`);
    process.exit(1);
  });
}
