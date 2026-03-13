import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { ProxyProbeEndpoint } from './subscription-probe-target.js';

const XRAY_VALIDATE_TIMEOUT_MS = 3_000;
const XRAY_BOOT_TIMEOUT_MS = 6_000;
const XRAY_STOP_TIMEOUT_MS = 2_000;

export interface XrayProxyRuntime {
  proxyUrl: string;
  stop: () => Promise<void>;
}

function buildTlsSettings(endpoint: ProxyProbeEndpoint) {
  const tlsSettings: Record<string, unknown> = {};
  if (endpoint.sni) tlsSettings.serverName = endpoint.sni;
  if (endpoint.fingerprint) tlsSettings.fingerprint = endpoint.fingerprint;
  if (endpoint.alpn.length > 0) tlsSettings.alpn = endpoint.alpn;
  if (endpoint.allowInsecure) tlsSettings.allowInsecure = true;
  return tlsSettings;
}

function buildRealitySettings(endpoint: ProxyProbeEndpoint) {
  const realitySettings: Record<string, unknown> = {
    show: false,
    fingerprint: endpoint.fingerprint || 'chrome',
    serverName: endpoint.sni || endpoint.address,
    publicKey: endpoint.publicKey || '',
    shortId: endpoint.shortId || '',
    spiderX: endpoint.spiderX || '/',
  };
  return realitySettings;
}

function buildTransportSettings(endpoint: ProxyProbeEndpoint) {
  const network = endpoint.network || 'tcp';
  const streamSettings: Record<string, unknown> = { network, security: endpoint.security };

  if (endpoint.security === 'tls') {
    streamSettings.tlsSettings = buildTlsSettings(endpoint);
  } else if (endpoint.security === 'reality') {
    streamSettings.realitySettings = buildRealitySettings(endpoint);
  }

  if (network === 'ws') {
    const wsSettings: Record<string, unknown> = {};
    if (endpoint.path) wsSettings.path = endpoint.path;
    if (endpoint.hostHeader) wsSettings.headers = { Host: endpoint.hostHeader };
    streamSettings.wsSettings = wsSettings;
  } else if (network === 'grpc') {
    const grpcSettings: Record<string, unknown> = {};
    if (endpoint.serviceName || endpoint.path) {
      grpcSettings.serviceName = endpoint.serviceName || endpoint.path;
    }
    if (endpoint.authority) grpcSettings.authority = endpoint.authority;
    streamSettings.grpcSettings = grpcSettings;
  } else if (network === 'httpupgrade') {
    const httpupgradeSettings: Record<string, unknown> = {};
    if (endpoint.path) httpupgradeSettings.path = endpoint.path;
    if (endpoint.hostHeader) httpupgradeSettings.host = endpoint.hostHeader;
    streamSettings.httpupgradeSettings = httpupgradeSettings;
  }

  return streamSettings;
}

function buildOutbound(endpoint: ProxyProbeEndpoint) {
  const streamSettings = buildTransportSettings(endpoint);

  if (endpoint.protocol === 'vless') {
    return {
      tag: 'proxy',
      protocol: 'vless',
      settings: {
        vnext: [
          {
            address: endpoint.address,
            port: endpoint.port,
            users: [
              {
                id: endpoint.id,
                encryption: endpoint.encryption || 'none',
                ...(endpoint.flow ? { flow: endpoint.flow } : {}),
              },
            ],
          },
        ],
      },
      streamSettings,
    };
  }

  if (endpoint.protocol === 'vmess') {
    return {
      tag: 'proxy',
      protocol: 'vmess',
      settings: {
        vnext: [
          {
            address: endpoint.address,
            port: endpoint.port,
            users: [
              {
                id: endpoint.id,
                security: endpoint.encryption || 'auto',
                alterId: endpoint.alterId ?? 0,
              },
            ],
          },
        ],
      },
      streamSettings,
    };
  }

  if (endpoint.protocol === 'trojan') {
    return {
      tag: 'proxy',
      protocol: 'trojan',
      settings: {
        servers: [
          {
            address: endpoint.address,
            port: endpoint.port,
            password: endpoint.password,
          },
        ],
      },
      streamSettings,
    };
  }

  if (endpoint.protocol === 'shadowsocks') {
    return {
      tag: 'proxy',
      protocol: 'shadowsocks',
      settings: {
        servers: [
          {
            address: endpoint.address,
            port: endpoint.port,
            method: endpoint.method,
            password: endpoint.password,
          },
        ],
      },
      streamSettings,
    };
  }

  throw new Error(`Unsupported probe protocol: ${endpoint.protocol}`);
}

function buildXrayConfig(endpoint: ProxyProbeEndpoint, localProxyPort: number) {
  return {
    log: {
      loglevel: 'warning',
    },
    routing: {
      domainStrategy: 'AsIs',
    },
    inbounds: [
      {
        tag: 'probe-http-in',
        listen: '127.0.0.1',
        port: localProxyPort,
        protocol: 'http',
        settings: {
          timeout: 30,
        },
      },
    ],
    outbounds: [
      buildOutbound(endpoint),
      {
        tag: 'direct',
        protocol: 'freedom',
      },
      {
        tag: 'block',
        protocol: 'blackhole',
      },
    ],
  };
}

function validateXrayExecutable(candidate: string) {
  const result = spawnSync(candidate, ['version'], {
    timeout: XRAY_VALIDATE_TIMEOUT_MS,
    windowsHide: true,
    encoding: 'utf8',
  });

  if (result.error) return false;
  if (result.status === 0) return true;

  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.toLowerCase();
  return text.includes('xray');
}

function resolveXrayExecutable() {
  const candidates = [
    process.env.XRAY_BIN,
    'xray',
    '/usr/local/x-ui/bin/xray',
    '/usr/local/x-ui/bin/xray-linux-amd64',
    '/usr/local/bin/xray',
    '/usr/bin/xray',
  ].filter((value): value is string => Boolean(value && value.trim()));

  for (const candidate of candidates) {
    if (validateXrayExecutable(candidate)) {
      return candidate;
    }
  }

  throw new Error('Xray binary not found. Install xray on the DMITProxy server or set XRAY_BIN.');
}

function reservePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to reserve a local probe port.')));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function waitForProxyPort(port: number, child: ChildProcessWithoutNullStreams) {
  return new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + XRAY_BOOT_TIMEOUT_MS;
    const stderrLines: string[] = [];

    const onData = (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim();
      if (text) stderrLines.push(text);
      while (stderrLines.length > 20) stderrLines.shift();
    };

    child.stderr.on('data', onData);

    const cleanup = () => {
      child.stderr.off('data', onData);
    };

    const attempt = () => {
      if (child.exitCode !== null) {
        cleanup();
        reject(
          new Error(
            stderrLines.join('\n') || `xray exited early with code ${String(child.exitCode)}.`,
          ),
        );
        return;
      }

      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        cleanup();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          cleanup();
          reject(
            new Error(stderrLines.join('\n') || 'Timed out while starting the local xray proxy.'),
          );
          return;
        }
        setTimeout(attempt, 150);
      });
    };

    attempt();
  });
}

async function stopChildProcess(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null) return;

  child.kill('SIGTERM');
  const deadline = Date.now() + XRAY_STOP_TIMEOUT_MS;
  while (child.exitCode === null && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

export async function startXrayProxy(endpoint: ProxyProbeEndpoint): Promise<XrayProxyRuntime> {
  const executable = resolveXrayExecutable();
  const localProxyPort = await reservePort();
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prism-node-quality-'));
  const configPath = path.join(runtimeDir, 'xray-config.json');

  await fs.writeFile(
    configPath,
    JSON.stringify(buildXrayConfig(endpoint, localProxyPort), null, 2),
  );

  const child = spawn(executable, ['run', '-c', configPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  try {
    await waitForProxyPort(localProxyPort, child);
  } catch (error) {
    await stopChildProcess(child);
    await fs.rm(runtimeDir, { recursive: true, force: true });
    throw error;
  }

  return {
    proxyUrl: `http://127.0.0.1:${localProxyPort}`,
    stop: async () => {
      await stopChildProcess(child);
      await fs.rm(runtimeDir, { recursive: true, force: true });
    },
  };
}
