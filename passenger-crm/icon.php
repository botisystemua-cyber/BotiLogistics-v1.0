<?php
// Dynamic PWA icon generator
// Usage: icon.php?name=Fly&s=192  →  PNG with "FL" initials on dark-blue bg
// Usage: icon.php?name=Express+SV+Travel&s=512  →  PNG with "ES" initials

$name = isset($_GET['name']) ? trim($_GET['name']) : '';
$size = isset($_GET['s']) ? intval($_GET['s']) : 192;
if ($size < 48) $size = 48;
if ($size > 512) $size = 512;

// Build initials (max 2 chars from first 2 words)
$initials = '';
if ($name) {
    $words = preg_split('/\s+/', $name);
    foreach ($words as $w) {
        if (mb_strlen($w) > 0) {
            $initials .= mb_strtoupper(mb_substr($w, 0, 1, 'UTF-8'), 'UTF-8');
            if (mb_strlen($initials) >= 2) break;
        }
    }
}
if (!$initials) $initials = 'BL';

// Caching — same name+size = same image, cache for 30 days
$etag = '"icon-' . md5($name . $size) . '"';
header('Cache-Control: public, max-age=2592000');
header('ETag: ' . $etag);
if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    http_response_code(304);
    exit;
}

// Find a bold TTF font
$fontPaths = [
    __DIR__ . '/fonts/Montserrat-ExtraBold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
];
$font = null;
foreach ($fontPaths as $p) {
    if (file_exists($p)) { $font = $p; break; }
}

$img = imagecreatetruecolor($size, $size);

// Colors
$bg    = imagecolorallocate($img, 0x1a, 0x3a, 0x5e); // dark blue
$white = imagecolorallocate($img, 255, 255, 255);

// Fill background
imagefilledrectangle($img, 0, 0, $size, $size, $bg);

if ($font) {
    // Nice TTF rendering
    $fontSize = $size * 0.38;
    $bbox = imagettfbbox($fontSize, 0, $font, $initials);
    $textW = $bbox[2] - $bbox[0];
    $textH = $bbox[1] - $bbox[7];
    $x = ($size - $textW) / 2 - $bbox[0];
    $y = ($size - $textH) / 2 - $bbox[7];
    imagettftext($img, $fontSize, 0, (int)$x, (int)$y, $white, $font, $initials);
} else {
    // Fallback: draw with built-in font on small canvas, scale up
    $smallSize = 40;
    $small = imagecreatetruecolor($smallSize, $smallSize);
    $sBg = imagecolorallocate($small, 0x1a, 0x3a, 0x5e);
    $sWh = imagecolorallocate($small, 255, 255, 255);
    imagefilledrectangle($small, 0, 0, $smallSize, $smallSize, $sBg);
    $fw = imagefontwidth(5) * mb_strlen($initials);
    $fh = imagefontheight(5);
    imagestring($small, 5, (int)(($smallSize - $fw) / 2), (int)(($smallSize - $fh) / 2), $initials, $sWh);
    imagecopyresampled($img, $small, 0, 0, 0, 0, $size, $size, $smallSize, $smallSize);
    imagedestroy($small);
}

header('Content-Type: image/png');
imagepng($img);
imagedestroy($img);
