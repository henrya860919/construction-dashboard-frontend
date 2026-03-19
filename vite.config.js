import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import os from 'node:os';
/** 取得本機第一個非內部 IPv4，供手機連線時 HMR WebSocket 使用 */
function getNetworkHost() {
    const ifaces = os.networkInterfaces();
    for (const list of Object.values(ifaces ?? {})) {
        if (!list)
            continue;
        for (const iface of list) {
            if (iface.family === 'IPv4' && !iface.internal)
                return iface.address;
        }
    }
    return undefined;
}
export default defineConfig({
    plugins: [
        vue(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'vite.svg'],
            manifest: {
                name: '現場查驗系統',
                short_name: '查驗',
                description: '營造工地現場查驗、缺失改善、報修管理',
                theme_color: '#0a0a0a',
                background_color: '#0a0a0a',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/mobile',
                scope: '/',
                icons: [
                    { src: '/vite.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
                    { src: '/vite.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https?.*\/api\//,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            networkTimeoutSeconds: 10,
                            expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        port: 5175,
        host: '0.0.0.0',
        hmr: {
            host: getNetworkHost() ?? 'localhost',
            port: 5175,
            protocol: 'ws',
        },
        proxy: {
            '/api': {
                target: 'http://localhost:3003',
                changeOrigin: true,
            },
        },
    },
    preview: {
        port: 5175,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: 'http://localhost:3003',
                changeOrigin: true,
            },
        },
    },
});
