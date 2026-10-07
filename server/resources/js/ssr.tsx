import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import ReactDOMServer from 'react-dom/server';
import { DialogProvider } from '@/components/foxy/dialogs';

const appName = import.meta.env.VITE_APP_NAME || 'FoxyExam';

createServer((page) =>
    createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        title: (title) => `${title} · ${appName}`,
        resolve: (name) =>
            resolvePageComponent<any>(
                `./pages/${name}.tsx`,
                import.meta.glob('./pages/**/*.tsx')
            ),
        setup: ({ App, props }) => (
            <DialogProvider>
                <App {...props} />
            </DialogProvider>
        ),
    })
);
