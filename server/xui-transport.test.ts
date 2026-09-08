import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requestXuiTransport, stripHopByHopHeaders } from './xui-transport.js';
import type { XuiTarget } from './xui.js';

describe('bounded XUI transport', () => {
  it('strips standard and connection-declared hop headers', () => {
    expect(
      stripHopByHopHeaders({
        Connection: 'x-hop',
        'x-hop': 'fixture',
        'Proxy-Authorization': 'fixture',
        Cookie: 'session=kept',
      }),
    ).toEqual({ Cookie: 'session=kept' });
  });
  let target: XuiTarget;
  const server = createServer((req, res) => {
    const json = () => {
      if (!res.destroyed) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ method: req.method, cookie: req.headers.cookie }));
      }
    };
    if (req.url === '/never') return;
    if (req.url === '/body-hang') {
      res.writeHead(200);
      res.write('partial');
      return;
    }
    if (req.url === '/cut') {
      res.writeHead(200, { 'Content-Length': '100' });
      res.write('partial');
      setImmediate(() => res.destroy());
      return;
    }
    if (req.url === '/large') {
      res.end(Buffer.alloc(4096));
      return;
    }
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/ok', 'Set-Cookie': 'session=redirected; Path=/' });
      res.end();
      return;
    }
    if (req.url === '/unsafe') {
      res.writeHead(302, { Location: 'https://example.invalid/private' });
      res.end();
      return;
    }
    if (req.url === '/slow-a') {
      setTimeout(() => {
        if (!res.destroyed) {
          res.writeHead(302, { Location: '/slow-b' });
          res.end();
        }
      }, 70);
      return;
    }
    if (req.url === '/slow-b') {
      setTimeout(json, 70);
      return;
    }
    json();
  });
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    target = {
      protocol: 'http:',
      hostname: '127.0.0.1',
      port,
      hostHeader: `127.0.0.1:${port}`,
      basePath: '',
    };
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it.each(['/never', '/body-hang'])('bounds the complete response for %s', async (path) => {
    await expect(requestXuiTransport({ target, path, timeoutMs: 100 })).rejects.toMatchObject({
      code: 'timeout',
    });
  });
  it('rejects a truncated response instead of leaving the promise pending', async () => {
    await expect(
      requestXuiTransport({ target, path: '/cut', timeoutMs: 2000 }),
    ).rejects.toMatchObject({ code: 'network' });
  });
  it('caps response memory', async () => {
    await expect(
      requestXuiTransport({ target, path: '/large', maxResponseBytes: 128 }),
    ).rejects.toMatchObject({ code: 'response-too-large' });
  });
  it('uses a single deadline across redirects', async () => {
    await expect(
      requestXuiTransport({ target, path: '/slow-a', timeoutMs: 110 }),
    ).rejects.toMatchObject({ code: 'timeout' });
  });
  it('preserves redirect cookies and changes a 302 POST to GET', async () => {
    const response = await requestXuiTransport({
      target,
      path: '/redirect',
      method: 'POST',
      body: 'a=b',
    });
    expect(JSON.parse(response.body.toString())).toMatchObject({
      method: 'GET',
      cookie: 'session=redirected',
    });
    expect(response.cookies).toHaveLength(1);
  });
  it('does not follow an external redirect', async () => {
    await expect(requestXuiTransport({ target, path: '/unsafe' })).rejects.toMatchObject({
      code: 'redirect',
    });
  });
  it('cancels an outstanding upstream request', async () => {
    const controller = new AbortController();
    const promise = requestXuiTransport({ target, path: '/never', signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'aborted' });
  });
});
