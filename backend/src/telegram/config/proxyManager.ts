import logger from '../../utils/logger';

interface ProxyConfig {
    host: string;
    port: number;
    username: string;
    password: string;
}

class ProxyRotationManager {
    private proxies: ProxyConfig[] = [];
    private currentIndex: number = 0;

    constructor() {
        this.loadProxiesFromEnv();
    }

    private loadProxiesFromEnv(): void {
        const proxyList = process.env.PROXY_LIST;
        const demoMode = process.env.PROXY_DEMO_MODE === 'true';

        if (!proxyList && !demoMode) {
            logger.warn('PROXY_LIST not found in environment variables');
            return;
        }

        if (demoMode) {
            logger.info('Demo mode enabled - simulating proxy connections');
            // Создаём демо-прокси для тестирования
            this.proxies = [
                { host: 'demo-proxy-1.server.com', port: 8080, username: 'demo', password: 'demo' },
                { host: 'demo-proxy-2.server.com', port: 8080, username: 'demo', password: 'demo' }
            ];
            return;
        }

        if (!proxyList) return;

        try {
            const proxyStrings = proxyList.split(',');
            this.proxies = proxyStrings.map(proxyStr => {
                const parts = proxyStr.trim().split(':');
                if (parts.length !== 4) {
                    throw new Error(`Invalid proxy format: ${proxyStr}. Expected format: host:port:username:password`);
                }

                return {
                    host: parts[0],
                    port: parseInt(parts[1], 10),
                    username: parts[2],
                    password: parts[3]
                };
            });

            logger.info(`Loaded ${this.proxies.length} server proxies from configuration`);
        } catch (error) {
            logger.error('Error parsing PROXY_LIST:', error);
            this.proxies = [];
        }
    }

    /**
     * Get next proxy using round-robin rotation
     */
    getNextProxy(): ProxyConfig | null {
        if (this.proxies.length === 0) {
            logger.warn('No proxies available');
            return null;
        }

        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

        logger.info(`Selected proxy: ${proxy.host}:${proxy.port} (${this.currentIndex}/${this.proxies.length})`);
        return proxy;
    }

    /**
     * Get current proxy without advancing the index
     */
    getCurrentProxy(): ProxyConfig | null {
        if (this.proxies.length === 0) {
            return null;
        }
        return this.proxies[this.currentIndex];
    }

    /**
     * Test proxy connection via HTTP CONNECT method
     */
    async testProxyConnection(proxy: ProxyConfig): Promise<boolean> {
        try {
            logger.info(`Testing HTTP proxy connection: ${proxy.host}:${proxy.port}`);

            // Демо-режим - симулируем успешное подключение
            if (process.env.PROXY_DEMO_MODE === 'true') {
                await new Promise(resolve => setTimeout(resolve, 500)); // Имитация задержки
                logger.info(`Demo mode: HTTP proxy connection successful: ${proxy.host}:${proxy.port}`);
                return true;
            }

            const http = require('http');
            return new Promise<boolean>((resolve) => {
                const timeout = 5000; // 5 seconds timeout

                const options = {
                    host: proxy.host,
                    port: proxy.port,
                    method: 'CONNECT',
                    path: 'httpbin.org:80',
                    headers: {
                        'Proxy-Authorization': `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}`
                    },
                    timeout: timeout
                };

                const req = http.request(options);

                req.setTimeout(timeout, () => {
                    req.destroy();
                    logger.warn(`HTTP proxy connection timeout: ${proxy.host}:${proxy.port}`);
                    resolve(false);
                });

                req.on('connect', (res: any, socket: any) => {
                    socket.end();
                    logger.info(`HTTP proxy connection successful: ${proxy.host}:${proxy.port}`);
                    resolve(true);
                });

                req.on('error', (error: Error) => {
                    logger.error(`HTTP proxy connection failed: ${proxy.host}:${proxy.port}`, error);
                    resolve(false);
                });

                req.end();
            });
        } catch (error) {
            logger.error(`Error testing HTTP proxy ${proxy.host}:${proxy.port}:`, error);
            return false;
        }
    }

    /**
     * Find first working proxy from the list
     */
    async findWorkingProxy(): Promise<ProxyConfig | null> {
        if (this.proxies.length === 0) {
            logger.warn('No proxies available for testing');
            return null;
        }

        logger.info('Searching for working proxy...');

        // Test proxies starting from current index
        const startIndex = this.currentIndex;
        let attempts = 0;

        while (attempts < this.proxies.length) {
            const proxy = this.getNextProxy();
            if (!proxy) break;

            const isWorking = await this.testProxyConnection(proxy);
            if (isWorking) {
                logger.info(`Found working proxy: ${proxy.host}:${proxy.port}`);
                return proxy;
            }

            attempts++;
        }

        logger.error('No working proxies found after testing all available proxies');
        return null;
    }

    /**
     * Convert proxy config to HTTP format for Telethon
     */
    formatForTelethon(proxy: ProxyConfig): string {
        return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    }

    /**
     * Get total number of proxies
     */
    getTotalProxies(): number {
        return this.proxies.length;
    }

    /**
     * Reset rotation index to start from beginning
     */
    resetRotation(): void {
        this.currentIndex = 0;
        logger.info('Proxy rotation index reset to 0');
    }
}

// Singleton instance
export const proxyManager = new ProxyRotationManager();

export { ProxyConfig, ProxyRotationManager };