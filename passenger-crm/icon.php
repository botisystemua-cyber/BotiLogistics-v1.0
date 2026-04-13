<?php
// Dynamic PWA icon generator
// Usage: icon.php?name=Fly&s=192  →  elegant black italic "F" on green gradient
// Usage: icon.php?name=Express+SV+Travel&s=512  →  black italic "E"

$name = isset($_GET['name']) ? trim($_GET['name']) : '';
$size = isset($_GET['s']) ? intval($_GET['s']) : 192;
if ($size < 48) $size = 48;
if ($size > 512) $size = 512;

// First letter of company name (single elegant capital)
$letter = '';
if ($name) {
    $letter = mb_strtoupper(mb_substr(trim($name), 0, 1, 'UTF-8'), 'UTF-8');
}
if (!$letter) $letter = 'B';

// Caching — same name+size = same image, cache for 30 days
$etag = '"icon-' . md5($name . $size) . '"';
header('Cache-Control: public, max-age=2592000');
header('ETag: ' . $etag);
if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    http_response_code(304);
    exit;
}

// Find an italic serif font (elegant look) then fall back to bold serif, then anything
$fontPaths = [
    __DIR__ . '/fonts/PlayfairDisplay-BoldItalic.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSerifBoldItalic.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
];
$font = null;
foreach ($fontPaths as $p) {
    if (file_exists($p)) { $font = $p; break; }
}

$img = imagecreatetruecolor($size, $size);
imagesavealpha($img, true);

// ── Green gradient background (emerald → green, like the brand) ──
$topR = 0x10; $topG = 0xb9; $topB = 0x81; // #10b981 emerald-500
$botR = 0x05; $botG = 0x8a; $botB = 0x5e; // #058a5e darker green
for ($y = 0; $y < $size; $y++) {
    $ratio = $y / max($size - 1, 1);
    $r = (int)($topR + ($botR - $topR) * $ratio);
    $g = (int)($topG + ($botG - $topG) * $ratio);
    $b = (int)($topB + ($botB - $topB) * $ratio);
    $lineColor = imagecolorallocate($img, $r, $g, $b);
    imageline($img, 0, $y, $size - 1, $y, $lineColor);
}

// ── Black letter with slight transparency feel ──
$black = imagecolorallocate($img, 0x15, 0x15, 0x15); // near-black, softer

if ($font) {
    // Large elegant italic letter
    $fontSize = $size * 0.6;
    $bbox = imagettfbbox($fontSize, 0, $font, $letter);
    $textW = $bbox[2] - $bbox[0];
    $textH = $bbox[1] - $bbox[7];
    $x = ($size - $textW) / 2 - $bbox[0];
    $y = ($size - $textH) / 2 - $bbox[7];
    imagettftext($img, $fontSize, 0, (int)$x, (int)$y, $black, $font, $letter);
} else {
    // Fallback: draw with built-in font on small canvas, scale up
    $smallSize = 30;
    $small = imagecreatetruecolor($smallSize, $smallSize);
    // Green bg for small canvas too
    $sBg = imagecolorallocate($small, 0x10, 0xb9, 0x81);
    $sBk = imagecolorallocate($small, 0x15, 0x15, 0x15);
    imagefilledrectangle($small, 0, 0, $smallSize, $smallSize, $sBg);
    $fw = imagefontwidth(5);
    $fh = imagefontheight(5);
    imagestring($small, 5, (int)(($smallSize - $fw) / 2), (int)(($smallSize - $fh) / 2), $letter, $sBk);
    imagecopyresampled($img, $small, 0, 0, 0, 0, $size, $size, $smallSize, $smallSize);
    imagedestroy($small);
}

header('Content-Type: image/png');
imagepng($img, null, 9); // max compression
imagedestroy($img);
