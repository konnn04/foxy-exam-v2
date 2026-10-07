import '../css/app.css';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { DialogProvider } from '@/components/foxy/dialogs';

/**
 * Lecturers use /lecturer, admins /admin — the very same portal (server: PortalAlias). Pages link to
 * '/admin/...' everywhere, so visits are mapped onto the portal of the logged-in role in one place.
 */
function aliasPortal(portal: string | undefined) {
    if (!portal || portal === '/admin' || typeof window === 'undefined' || (router as any).__portal) return;
    const visit = router.visit.bind(router) as (href: any, options?: any) => void;
    const map = (u: string) => (u === '/admin' || /^\/admin(?=[/?#])/.test(u) ? portal + u.slice('/admin'.length) : u);
    (router as any).visit = (href: any, options?: any) =>
        visit(typeof href === 'string' ? map(href) : href && typeof href.url === 'string' ? { ...href, url: map(href.url) } : href, options);
    (router as any).__portal = portal;
}

const appName = import.meta.env.VITE_APP_NAME || 'FoxyExam';

createInertiaApp({
    title: (title) => `${title} · ${appName}`,
    resolve: (name) =>
        resolvePageComponent<any>(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx')
        ),
    setup({ el, App, props }) {
        aliasPortal((props.initialPage.props as any).portal);
        const flash = (props.initialPage.props as any).flash;
        const tree = (
            <DialogProvider initialFlash={flash}>
                <App {...props} />
            </DialogProvider>
        );
        if (el.hasChildNodes()) {
            hydrateRoot(el, tree);
        } else {
            createRoot(el).render(tree);
        }
    },
    progress: {
        color: '#f97316',
        showSpinner: false,
    },
});
