<?php
// Dynamic PWA manifest
// Usage: manifest.php?name=Fly&logo=https://...png → manifest with custom icon
// Usage: manifest.php?name=Fly → manifest with generated icon (icon.php)
// Usage: manifest.php → default BotiLogistics manifest
header('Content-Type: application/manifest+json; charset=utf-8');
header('Cache-Control: public, max-age=86400');

$name = isset($_GET['name']) ? trim($_GET['name']) : '';
$logo = isset($_GET['logo']) ? trim($_GET['logo']) : '';
$appName = $name ? $name . ' CRM' : 'BotiLogistics CRM';
$shortName = $name ?: 'BotiLogistics';

// Build absolute base URL
$proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
$dir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/';
$base = $proto . '://' . $host . $dir;

if ($logo) {
    // Custom logo URL — one 512x512 works for all devices
    $icons = [
        ['src' => $logo, 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
    ];
} elseif ($name) {
    // Auto-generated icon from icon.php
    $iconParam = 'icon.php?name=' . rawurlencode($name);
    $icons = [
        ['src' => $base . $iconParam . '&s=192', 'sizes' => '192x192', 'type' => 'image/png'],
        ['src' => $base . $iconParam . '&s=512', 'sizes' => '512x512', 'type' => 'image/png'],
    ];
} else {
    // Default icons
    $icons = [
        ['src' => $base . 'icon.php?s=192', 'sizes' => '192x192', 'type' => 'image/png'],
        ['src' => $base . 'icon.php?s=512', 'sizes' => '512x512', 'type' => 'image/png'],
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
