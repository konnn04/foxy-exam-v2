<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <title inertia>{{ config('app.name', 'FoxyExam') }}</title>

        <!-- Typography (FoxyExam Screens v2): Instrument Sans + JetBrains Mono; Archivo for the landing page -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">

        <!-- Scripts & Styles -->
        <script>
            (function() {
                try {
                    var storedTheme = localStorage.getItem('foxy_theme');
                    var isDark = storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                    if (isDark) {
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                    }
                } catch (_) {}
            })();
        </script>
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased bg-background text-foreground min-h-screen selection:bg-primary selection:text-primary-foreground">
        @inertia
    </body>
</html>
