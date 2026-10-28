<?php
declare(strict_types=1);
require __DIR__ . '/../config/db.php';
api_boot('GET');

$pdo = db();
$rows = $pdo->query(
    'SELECT b.id, b.slug, b.name, b.region, b.description, b.prep_time, b.cook_time,
            b.ingredients_json, b.steps_json,
            ROUND(AVG(r.rating), 1) AS avg_rating, COUNT(r.id) AS review_count
       FROM biryanis b LEFT JOIN reviews r ON r.biryani_id = b.id
      GROUP BY b.id ORDER BY b.id'
)->fetchAll();

foreach ($rows as &$r) {
    $r['id']           = (int)$r['id'];
    $r['prep_time']    = (int)$r['prep_time'];
    $r['cook_time']    = (int)$r['cook_time'];
    $r['review_count'] = (int)$r['review_count'];
    $r['avg_rating']   = $r['avg_rating'] !== null ? (float)$r['avg_rating'] : null;
    $r['ingredients']  = json_decode((string)$r['ingredients_json'], true) ?: [];
    $r['steps']        = json_decode((string)$r['steps_json'], true) ?: [];
    unset($r['ingredients_json'], $r['steps_json']);
}
unset($r);

$favs = [];
if (!empty($_SESSION['user_id'])) {
    $s = $pdo->prepare('SELECT biryani_id FROM favorites WHERE user_id = ?');
    $s->execute([(int)$_SESSION['user_id']]);
    $favs = array_map('intval', $s->fetchAll(PDO::FETCH_COLUMN));
}

json_out(['ok' => true, 'biryanis' => $rows, 'favorites' => $favs]);
