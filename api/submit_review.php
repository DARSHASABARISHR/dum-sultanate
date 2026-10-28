<?php
declare(strict_types=1);
require __DIR__ . '/../config/db.php';

$in = api_boot('POST', true);

const HIGHLIGHTS = ['aroma', 'rice_texture', 'meat_softness', 'spiciness', 'dalcha'];
const GRIEVANCES = ['excess_oil', 'overcooked_rice', 'unbalanced_spices', 'too_spicy', 'undercooked_meat', 'too_salty'];

$bid    = filter_var($in['biryani_id'] ?? null, FILTER_VALIDATE_INT);
$rating = filter_var($in['rating'] ?? null, FILTER_VALIDATE_INT);
if (!$bid || $bid < 1 || !$rating || $rating < 1 || $rating > 5) {
    json_out(['ok' => false, 'error' => 'invalid_input'], 422);
}

$pick = static function ($v, array $allowed): array {
    return is_array($v) ? array_values(array_unique(array_intersect(array_map('strval', $v), $allowed))) : [];
};
$hi   = $pick($in['highlights'] ?? [], HIGHLIGHTS);
$gr   = $pick($in['grievances'] ?? [], GRIEVANCES);
$text = static fn($v): string => mb_substr(trim(is_string($v) ? $v : ''), 0, 2000);
$complaints = $text($in['complaints'] ?? '');
$comments   = $text($in['comments'] ?? '');

$pdo = db();
$chk = $pdo->prepare('SELECT 1 FROM biryanis WHERE id = ?');
$chk->execute([$bid]);
if (!$chk->fetchColumn()) {
    json_out(['ok' => false, 'error' => 'not_found'], 404);
}

$pdo->beginTransaction();
$pdo->prepare(
    'INSERT INTO reviews (user_id, biryani_id, rating, highlights, complaints_improvements, comments)
     VALUES (?, ?, ?, ?, ?, ?)'
)->execute([(int)$_SESSION['user_id'], $bid, $rating, implode(',', $hi), $complaints, $comments]);
$rid = (int)$pdo->lastInsertId();
$ins = $pdo->prepare('INSERT IGNORE INTO review_grievances (review_id, tag) VALUES (?, ?)');
foreach ($gr as $tag) {
    $ins->execute([$rid, $tag]);
}
$pdo->commit();

json_out(['ok' => true, 'review_id' => $rid]);
