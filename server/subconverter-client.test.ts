import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderSubscription, SubconverterError, type SubFormat } from './subconverter-client.js';

interface CapturedRequest {
  url: string;
  method: string;
  parsedQuery: URLSearchParams;
}

interface StubServer {
  baseUrl: string;
  requests: CapturedRequest[];
  setResponder: (handler: (req: CapturedRequest) => { status: number; body: string }) => void;
  close: () => Promise<void>;
}

async function startStubServer(): Promise<StubServer> {
  const requests: CapturedRequest[] = [];
  let respond: (req: CapturedRequest) => { status: number; body: string } = () => ({
    status: 200,
    body: 'stub-default-body',
  });

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    const parsedUrl = new URL(url, 'http://localhost');
    const captured: CapturedRequest = {
      url,
      method: req.method ?? 'GET',
      parsedQuery: parsedUrl.searchParams,
    };
    requests.push(captured);

    const { status, body } = respond(captured);
    res.statusCode = status;
    res.setHeader('content-type', 'text/plain');
    res.end(body);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    requests,
    setResponder(handler) {
      respond = handler;
    },
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

const ENV_KEYS = [
  'SUBCONVERTER_URL',
  'SUBCONVERTER_CONFIG_URL',
  'SUBCONVERTER_CONFIG_CLASH',
  'SUBCONVERTER_CONFIG_SINGBOX',
  'SUBCONVERTER_CONFIG_SURGE',
  'SERVER_PORT',
] as const;

describe('subconverter-client', () => {
  let stub: StubServer;
  const previousEnv = new Map<string, string | undefined>();

  beforeEach(async () => {
    stub = await startStubServer();
    for (const key of ENV_KEYS) {
      previousEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env.SUBCONVERTER_URL = stub.baseUrl;
  });

  afterEach(async () => {
    await stub.close();
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    previousEnv.clear();
  });

  it('builds the correct request for clash with our local default template', async () => {
    process.env.SERVER_PORT = '4321';
    stub.setResponder(() => ({ status: 200, body: 'proxies:\n  - {}\n' }));

    const result = await renderSubscription({
      format: 'clash',
      rawSourceUrl: 'http://127.0.0.1:3001/sub/_raw/abc',
    });

    expect(result.contentType).toBe('text/yaml; charset=utf-8');
    expect(result.filename).toBe('clash-config.yaml');
    expect(result.body).toContain('proxies');

    expect(stub.requests).toHaveLength(1);
    const query = stub.requests[0].parsedQuery;
    expect(query.get('target')).toBe('clash');
    expect(query.get('url')).toBe('http://127.0.0.1:3001/sub/_raw/abc');
    expect(query.get('config')).toBe('http://127.0.0.1:4321/sub/_template/dmit-default.toml');
    expect(query.get('emoji')).toBe('false');
    expect(query.get('new_name')).toBe('true');
    expect(query.get('expand')).toBe('false');
  });

  it('passes ver=4 for surge and exposes surge.conf filename', async () => {
    stub.setResponder(() => ({ status: 200, body: '[Proxy]\n' }));

    const result = await renderSubscription({
      format: 'surge',
      rawSourceUrl: 'http://127.0.0.1:3001/sub/_raw/abc',
    });

    expect(result.filename).toBe('surge.conf');
    const query = stub.requests[0].parsedQuery;
    expect(query.get('target')).toBe('surge');
    expect(query.get('ver')).toBe('4');
  });

  it('exposes singbox config under a json filename', async () => {
    stub.setResponder(() => ({ status: 200, body: '{"outbounds":[]}' }));

    const result = await renderSubscription({
      format: 'singbox',
      rawSourceUrl: 'http://127.0.0.1:3001/sub/_raw/abc',
    });

    expect(result.contentType).toBe('application/json; charset=utf-8');
    expect(result.filename).toBe('sing-box-config.json');
    expect(stub.requests[0].parsedQuery.get('target')).toBe('singbox');
  });

  it('respects per-format SUBCONVERTER_CONFIG_* env override', async () => {
    process.env.SUBCONVERTER_CONFIG_URL = 'https://example.com/global.toml';
    process.env.SUBCONVERTER_CONFIG_CLASH = 'https://example.com/clash-only.toml';
    stub.setResponder(() => ({ status: 200, body: 'proxies: []\n' }));

    await renderSubscription({
      format: 'clash',
      rawSourceUrl: 'http://127.0.0.1:3001/sub/_raw/abc',
    });
    await renderSubscription({
      format: 'singbox',
      rawSourceUrl: 'http://127.0.0.1:3001/sub/_raw/abc',
    });

    expect(stub.requests[0].parsedQuery.get('config')).toBe('https://example.com/clash-only.toml');
    expect(stub.requests[1].parsedQuery.get('config')).toBe('https://example.com/global.toml');
  });

  it('throws SubconverterError on non-2xx responses with status and snippet', async () => {
    stub.setResponder(() => ({ status: 500, body: 'oops downstream config fetch failed' }));

    let captured: SubconverterError | null = null;
    try {
      await renderSubscription({
        format: 'clash',
        rawSourceUrl: 'http://127.0.0.1:3001/sub/_raw/abc',
      });
    } catch (error) {
      captured = error as SubconverterError;
    }

    expect(captured).toBeInstanceOf(SubconverterError);
    expect(captured?.status).toBe(500);
    expect(captured?.message).toContain('500');
    expect(captured?.message).toContain('oops downstream');
  });

  it('throws SubconverterError on empty response body', async () => {
    stub.setResponder(() => ({ status: 200, body: '   ' }));

    await expect(
      renderSubscription({
        format: 'clash' as SubFormat,
        rawSourceUrl: 'http://127.0.0.1:3001/sub/_raw/abc',
      }),
    ).rejects.toBeInstanceOf(SubconverterError);
  });

  it('wraps network errors as SubconverterError', async () => {
    process.env.SUBCONVERTER_URL = 'http://127.0.0.1:1'; // closed port

    let captured: unknown = null;
    try {
      await renderSubscription({
        format: 'clash',
        rawSourceUrl: 'http://127.0.0.1:3001/sub/_raw/abc',
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(SubconverterError);
    expect((captured as SubconverterError).message).toMatch(/subconverter request failed/);
  });
});
