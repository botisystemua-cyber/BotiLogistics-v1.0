<?php
// Dynamic PWA manifest
// Usage: manifest.php?name=Fly → JSON manifest with company name + icon URLs
header('Content-Type: application/manifest+json; charset=utf-8');
header('Cache-Control: public, max-age=86400');

$name = isset($_GET['name']) ? trim($_GET['name']) : '';
$appName = $name ? $name . ' CRM' : 'BotiLogistics CRM';
$shortName = $name ?: 'BotiLogistics';

// Build absolute base URL for icons
$proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
$dir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/';
$base = $proto . '://' . $host . $dir;

if ($name) {
    $iconParam = 'icon.php?name=' . rawurlencode($name);
    $icons = [
        ['src' => $base . $iconParam . '&s=192', 'sizes' => '192x192', 'type' => 'image/png'],
        ['src' => $base . $iconParam . '&s=512', 'sizes' => '512x512', 'type' => 'image/png'],
    ];
} else {
    $icons = [
        ['src' => $base . 'icon-192.png', 'sizes' => '192x192', 'type' => 'image/png'],
        ['src' => $base . 'icon-512.png', 'sizes' => '512x512', 'type' => 'image/png'],
    ];
}

echo json_encode([
    'name' => $appName,
    'short_name' => $shortName,
    'description' => 'CRM Пасажири — ' . $shortName,
    'start_url' => $base,
    'scope' => $base,
    'display' => 'standalone',
    'orientation' => 'portrait',
    'theme_color' => '#1a3a5e',
    'background_color' => '#f5f7fa',
    'icons' => $icons,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
