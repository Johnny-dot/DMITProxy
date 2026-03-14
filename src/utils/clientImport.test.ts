import { describe, expect, it } from 'vitest';
import { buildClientImportUrl } from './clientImport';

describe('buildClientImportUrl', () => {
  const clashUrl = 'https://example.com/sub/123?flag=clash';
  const singBoxUrl = 'https://example.com/sub/123?flag=sing-box';
  const surgeUrl = 'https://example.com/sub/123?flag=surge';

  it('builds a sing-box remote import link', () => {
    expect(
      buildClientImportUrl({
        clientId: 'singBox',
        platform: 'ios',
        subscriptionUrl: singBoxUrl,
        subscriptionName: 'My Subscription',
        format: 'singbox',
      }),
    ).toBe(
      'sing-box://import-remote-profile?url=https%3A%2F%2Fexample.com%2Fsub%2F123%3Fflag%3Dsing-box#My%20Subscription',
    );
  });

  it('builds a Surge install-config link', () => {
    expect(
      buildClientImportUrl({
        clientId: 'surge',
        platform: 'ios',
        subscriptionUrl: surgeUrl,
        format: 'surge',
      }),
    ).toBe('surge:///install-config?url=https%3A%2F%2Fexample.com%2Fsub%2F123%3Fflag%3Dsurge');
  });

  it('builds a Clash Meta import link', () => {
    expect(
      buildClientImportUrl({
        clientId: 'clashMeta',
        platform: 'android',
        subscriptionUrl: clashUrl,
        format: 'clash',
      }),
    ).toBe('clashmeta://install-config?url=https%3A%2F%2Fexample.com%2Fsub%2F123%3Fflag%3Dclash');
  });

  it('builds a v2rayNG install-sub link', () => {
    expect(
      buildClientImportUrl({
        clientId: 'v2rayNG',
        platform: 'android',
        subscriptionUrl: 'https://example.com/sub/123',
        subscriptionName: 'Fast Link',
        format: 'universal',
      }),
    ).toBe('v2rayng://install-sub?url=https%3A%2F%2Fexample.com%2Fsub%2F123&name=Fast%20Link');
  });

  it('returns null when the client does not support a direct import link', () => {
    expect(
      buildClientImportUrl({
        clientId: 'flClash',
        platform: 'android',
        subscriptionUrl: clashUrl,
        format: 'clash',
      }),
    ).toBeNull();
  });

  it('returns null when the format does not match the client import path', () => {
    expect(
      buildClientImportUrl({
        clientId: 'surge',
        platform: 'ios',
        subscriptionUrl: clashUrl,
        format: 'clash',
      }),
    ).toBeNull();
  });
});
