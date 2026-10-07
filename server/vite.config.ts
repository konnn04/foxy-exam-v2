import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './resources/js'),
        },
    },
    build: {
        rollupOptions: {
            onwarn(warning, warn) {
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || warning.message?.includes('use client')) {
                    return;
                }
                warn(warning);
            },
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
                        return 'vendor-react';
                    }
                    if (id.includes('node_modules/@inertiajs/')) {
                        return 'vendor-inertia';
                    }
                    if (id.includes('node_modules/lucide-react/')) {
                        return 'vendor-icons';
                    }
                    if (id.includes('node_modules/@monaco-editor/')) {
                        return 'vendor-monaco';
                    }
                },
            },
        },
        chunkSizeWarningLimit: 1200,
    },
});
