<?php
declare(strict_types=1);
require __DIR__ . '/../config/db.php';

$in  = api_boot('POST', true);
$bid = filter_var($in['biryani_id'] ?? null, FILTER_VALIDATE_INT);
if (!$bid || $bid < 1) {
    json_out(['ok' => false, 'error' => 'invalid_biryani'], 422);
}

$pdo = db();
$uid = (int)$_SESSION['user_id'];

$chk = $pdo->prepare('SELECT 1 FROM biryanis WHERE id = ?');
$chk->execute([$bid]);
if (!$chk->fetchColumn()) {
    json_out(['ok' => false, 'error' => 'not_found'], 404);
}

$pdo->beginTransaction();
$del = $pdo->prepare('DELETE FROM favorites WHERE user_id = ? AND biryani_id = ?');
$del->execute([$uid, $bid]);
if ($del->rowCount() > 0) {
    $favorited = false;
} else {
    $pdo->prepare('INSERT IGNORE INTO favorites (user_id, biryani_id) VALUES (?, ?)')->execute([$uid, $bid]);
    $favorited = true;
}
$pdo->commit();

json_out(['ok' => true, 'favorited' => $favorited, 'biryani_id' => $bid]);
