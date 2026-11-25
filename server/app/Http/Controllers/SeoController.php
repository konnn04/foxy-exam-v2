<?php

namespace App\Http\Controllers;

/**
 * robots.txt and sitemap.xml for search engines. Only the PUBLIC marketing pages are ever listed;
 * everything behind a login (admin, student, exam, report links) is excluded from both files.
 */
class SeoController extends Controller
{
    /** path => [changefreq, priority]. The single list of indexable pages (the layout uses it for meta robots). */
    public const PUBLIC_PAGES = [
        '/' => ['weekly', '1.0'],
        '/features' => ['monthly', '0.8'],
        '/pricing' => ['monthly', '0.8'],
        '/about' => ['monthly', '0.6'],
        '/download' => ['weekly', '0.7'],
    ];

    /** Areas that must not be crawled even if a link to them leaks somewhere. */
    private const PRIVATE_PATHS = ['/admin', '/api', '/student', '/lecturer', '/login', '/logout', '/attempts', '/violation-report', '/notifications', '/pilot-requests', '/docs'];

    public static function isPublicPath(string $path): bool
    {
        return isset(self::PUBLIC_PAGES['/' . ltrim($path, '/')]);
    }

    public function robots()
    {
        $lines = ['User-agent: *', 'Allow: /$'];
        foreach (array_keys(self::PUBLIC_PAGES) as $p) {
            if ($p !== '/') {
                $lines[] = "Allow: {$p}";
            }
        }
        foreach (self::PRIVATE_PATHS as $p) {
            $lines[] = "Disallow: {$p}";
        }
        $lines[] = '';
        $lines[] = 'Sitemap: ' . url('/sitemap.xml');

        return response(implode("\n", $lines) . "\n", 200, ['Content-Type' => 'text/plain; charset=UTF-8', 'Cache-Control' => 'public, max-age=3600']);
    }

    public function sitemap()
    {
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach (self::PUBLIC_PAGES as $path => [$freq, $priority]) {
            $loc = htmlspecialchars(url($path), ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $xml .= "  <url><loc>{$loc}</loc><changefreq>{$freq}</changefreq><priority>{$priority}</priority></url>\n";
        }
        $xml .= '</urlset>' . "\n";

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8', 'Cache-Control' => 'public, max-age=3600']);
    }
}
