<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ClientReleaseService
{
    private const GITHUB_REPO = 'konnn04/foxy-exam-v2';
    private const CACHE_KEY = 'foxy_latest_client_release';
    private const CACHE_TTL_SECONDS = 600; // 10 minutes

    /**
     * Get the latest client release info from GitHub, with robust caching & static fallback.
     *
     * @return array{
     *   version: string,
     *   tag: string,
     *   published_at: string,
     *   exe_name: string,
     *   exe_url: string,
     *   exe_size_mb: string,
     *   exe_sha256: string,
     *   msi_name: string,
     *   msi_url: string,
     *   msi_size_mb: string,
     *   msi_sha256: string,
     * }
     */
    public static function getLatest(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function () {
            return self::fetchFromGitHub() ?? self::fallback();
        });
    }

    private static function fetchFromGitHub(): ?array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => 'ExamGuard-WebPortal',
                'Accept' => 'application/vnd.github.v3+json',
            ])->timeout(4)->get('https://api.github.com/repos/' . self::GITHUB_REPO . '/releases');

            if (!$response->successful()) {
                return null;
            }

            $releases = $response->json();
            if (!is_array($releases) || empty($releases)) {
                return null;
            }

            // Find latest client release (tag starts with client-)
            $clientRelease = null;
            foreach ($releases as $rel) {
                if (isset($rel['tag_name']) && str_starts_with($rel['tag_name'], 'client-')) {
                    $clientRelease = $rel;
                    break;
                }
            }

            // If none starts with client-, take the first release
            if (!$clientRelease) {
                $clientRelease = $releases[0];
            }

            $assets = $clientRelease['assets'] ?? [];
            $exeAsset = null;
            $msiAsset = null;

            foreach ($assets as $asset) {
                $name = $asset['name'] ?? '';
                if (str_ends_with($name, '.exe')) {
                    $exeAsset = $asset;
                } elseif (str_ends_with($name, '.msi')) {
                    $msiAsset = $asset;
                }
            }

            $tag = $clientRelease['tag_name'] ?? 'client-v0.1.0';
            $version = str_replace('client-', '', $tag);

            // Extract SHA-256 from asset digest or release body
            $body = $clientRelease['body'] ?? '';
            $exeSha = $exeAsset['digest'] ?? self::extractSha256($body, '.exe') ?: 'sha256:d6fd3375f86261d08f199c51b76244502d3c33fe775a25a6a3f7a4dafaf0c3a0';
            $msiSha = $msiAsset['digest'] ?? self::extractSha256($body, '.msi') ?: 'sha256:f5e729d0d123ad79dfa61a2103d802958e5613c428c9ec37dc4dd8bc3c009e99';

            return [
                'version' => $version,
                'tag' => $tag,
                'published_at' => $clientRelease['published_at'] ?? now()->toIso8601String(),
                'exe_name' => $exeAsset['name'] ?? 'FoxyExam.Client_0.1.0_x64-setup.exe',
                'exe_url' => $exeAsset['browser_download_url'] ?? "https://github.com/" . self::GITHUB_REPO . "/releases/download/{$tag}/FoxyExam.Client_0.1.0_x64-setup.exe",
                'exe_size_mb' => isset($exeAsset['size']) ? round($exeAsset['size'] / (1024 * 1024), 1) . ' MB' : '12.9 MB',
                'exe_sha256' => $exeSha,
                'msi_name' => $msiAsset['name'] ?? 'FoxyExam.Client_0.1.0_x64_en-US.msi',
                'msi_url' => $msiAsset['browser_download_url'] ?? "https://github.com/" . self::GITHUB_REPO . "/releases/download/{$tag}/FoxyExam.Client_0.1.0_x64_en-US.msi",
                'msi_size_mb' => isset($msiAsset['size']) ? round($msiAsset['size'] / (1024 * 1024), 1) . ' MB' : '15.8 MB',
                'msi_sha256' => $msiSha,
            ];
        } catch (\Throwable $e) {
            Log::warning('ClientReleaseService fetch failed: ' . $e->getMessage());
            return null;
        }
    }

    private static function extractSha256(string $body, string $ext): ?string
    {
        // Matches sha256:[a-f0-9]{64} near file extension
        if (preg_match('/' . preg_quote($ext, '/') . '.*?sha256:([a-f0-9]{64})/is', $body, $m)) {
            return $m[1];
        }
        if (preg_match('/sha256:([a-f0-9]{64})/i', $body, $m)) {
            return $m[1];
        }
        return null;
    }

    private static function fallback(): array
    {
        return [
            'version' => 'v0.1.0',
            'tag' => 'client-v0.1.0',
            'published_at' => '2026-11-07T05:01:37Z',
            'exe_name' => 'FoxyExam.Client_0.1.0_x64-setup.exe',
            'exe_url' => 'https://github.com/' . self::GITHUB_REPO . '/releases/download/client-v0.1.0/FoxyExam.Client_0.1.0_x64-setup.exe',
            'exe_size_mb' => '12.9 MB',
            'exe_sha256' => 'sha256:d6fd3375f86261d08f199c51b76244502d3c33fe775a25a6a3f7a4dafaf0c3a0',
            'msi_name' => 'FoxyExam.Client_0.1.0_x64_en-US.msi',
            'msi_url' => 'https://github.com/' . self::GITHUB_REPO . '/releases/download/client-v0.1.0/FoxyExam.Client_0.1.0_x64_en-US.msi',
            'msi_size_mb' => '15.8 MB',
            'msi_sha256' => 'sha256:f5e729d0d123ad79dfa61a2103d802958e5613c428c9ec37dc4dd8bc3c009e99',
        ];
    }
}
