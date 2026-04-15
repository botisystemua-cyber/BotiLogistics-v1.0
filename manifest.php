<?php
// Shared PWA manifest for BotiLogistics suite (passenger-crm + cargo-crm)
// Розміщений на рівні /BotiLogistics-v1.0/ — щоб scope покривав ОБИДВА модулі
// (passenger-crm + cargo-crm) і одне встановлення PWA працювало для обох.
//
// Usage: ../manifest.php?name=Fly&logo=https://...png → manifest with custom name + icon
// Usage: ../manifest.php?name=Fly → manifest with custom name (no icon)
// Usage: ../manifest.php → default BotiLogistics manifest
header('Content-Type: application/manifest+json; charset=utf-8');
header('Cache-Control: public, max-age=86400');

$name = isset($_GET['name']) ? trim($_GET['name']) : '';
$logo = isset($_GET['logo']) ? trim($_GET['logo']) : '';
$start = isset($_GET['start']) ? trim($_GET['start']) : '';
$appName = $name ? $name . ' CRM' : 'BotiLogistics CRM';
$shortName = $name ?: 'BotiLogistics';

// Build absolute base URL
// $dir тут — каталог, з якого цей PHP-файл був запитаний.
// Якщо файл лежить у /BotiLogistics-v1.0/manifest.php, scope буде
// /BotiLogistics-v1.0/ — і це покриє і passenger-crm/, і cargo-crm/.
$proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
$dir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/';
$base = $proto . '://' . $host . $dir;

// start_url: за замовчуванням відкриваємо passenger-crm (звідти користувач
// може перемкнутися на cargo-crm через бічне меню → "Посилки").
// Можна перевизначити через ?start=cargo-crm/Cargo.html.
$startUrl = $start
    ? $base . ltrim($start, '/')
    : $base . 'passenger-crm/Passengers.html';

$manifest = [
    'name' => $appName,
    'short_name' => $shortName,
    'description' => 'BotiLogistics CRM — ' . $shortName,
    'start_url' => $startUrl,
    'scope' => $base,
    'display' => 'standalone',
    'orientation' => 'portrait',
    'theme_color' => '#1a3a5e',
    'background_color' => '#f5f7fa',
];

if ($logo) {
    $manifest['icons'] = [
        ['src' => $logo, 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
    ];
}

echo json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
