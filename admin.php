<?php
declare(strict_types=1);
require __DIR__ . '/config/db.php';
start_secure_session();
if (empty($_SESSION['is_admin']) || $_SESSION['is_admin'] !== true) { http_response_code(403); exit('Access Denied'); }

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');
$pdo = db();
$h = static fn($s): string => htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

$totalUsers   = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
$totalReviews = (int)$pdo->query('SELECT COUNT(*) FROM reviews')->fetchColumn();
$top = $pdo->query('SELECT b.name, ROUND(AVG(r.rating),2) AS avg_r, COUNT(*) AS n FROM reviews r JOIN biryanis b ON b.id = r.biryani_id GROUP BY b.id ORDER BY avg_r DESC, n DESC LIMIT 1')->fetch();
$grievanceReviews = (int)$pdo->query("SELECT COUNT(*) FROM reviews r WHERE r.complaints_improvements <> '' OR EXISTS (SELECT 1 FROM review_grievances g WHERE g.review_id = r.id)")->fetchColumn();
$byTag = $pdo->query('SELECT tag, COUNT(*) AS c FROM review_grievances GROUP BY tag ORDER BY c DESC')->fetchAll();
$tagLabels = ['excess_oil' => 'Excess oil', 'overcooked_rice' => 'Overcooked rice', 'unbalanced_spices' => 'Unbalanced spices', 'too_spicy' => 'Too spicy', 'undercooked_meat' => 'Undercooked meat', 'too_salty' => 'Too salty'];
$maxTag = $byTag ? (int)$byTag[0]['c'] : 1;

$q = trim((string)($_GET['q'] ?? ''));
$only = !empty($_GET['grievances']);
$where = ['1=1']; $args = [];
if ($q !== '') {
    $where[] = '(b.name LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR r.comments LIKE ? OR r.complaints_improvements LIKE ?)';
    $like = '%' . addcslashes($q, '%_\\') . '%';
    array_push($args, $like, $like, $like, $like, $like);
}
if ($only) {
    $where[] = "(r.complaints_improvements <> '' OR EXISTS (SELECT 1 FROM review_grievances g WHERE g.review_id = r.id))";
}
$rs = $pdo->prepare('SELECT r.id, r.rating, r.highlights, r.complaints_improvements, r.comments, r.created_at, b.name AS biryani, u.name AS uname, u.email, u.user_code,
        (SELECT GROUP_CONCAT(g.tag SEPARATOR ",") FROM review_grievances g WHERE g.review_id = r.id) AS tags
        FROM reviews r JOIN users u ON u.id = r.user_id JOIN biryanis b ON b.id = r.biryani_id
        WHERE ' . implode(' AND ', $where) . ' ORDER BY r.created_at DESC LIMIT 200');
$rs->execute($args);
$reviews = $rs->fetchAll();
$users = $pdo->query('SELECT user_code, name, email, avatar_url, is_admin, created_at, last_login FROM users ORDER BY created_at DESC LIMIT 200')->fetchAll();
?>
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin | DUM SULTANATE</title><meta name="robots" content="noindex,nofollow">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Mulish:wght@400;600;700&display=swap">
<link rel="stylesheet" href="assets/css/style.css"></head>
<body class="adminpage">
<header class="nav"><a class="brand" href="index.php">DUM SULTANATE</a><span class="badge">Admin Control Center</span>
  <div class="navr"><a class="btn sm" href="index.php">Back to site</a></div></header>
<main class="wrap">
  <h1 class="vh">Control Center</h1>
  <div class="kpis">
    <div class="kpi"><span>Total foodies</span><b><?= $totalUsers ?></b></div>
    <div class="kpi"><span>Total reviews</span><b><?= $totalReviews ?></b></div>
    <div class="kpi"><span>Top rated biryani</span><b class="sm"><?= $top ? $h($top['name']) : 'No reviews yet' ?></b><?php if ($top): ?><small>★ <?= $h($top['avg_r']) ?> from <?= (int)$top['n'] ?> review(s)</small><?php endif; ?></div>
    <div class="kpi"><span>Reviews with grievances</span><b><?= $grievanceReviews ?></b></div>
  </div>

  <section class="panel"><h2>Grievances by type</h2>
    <?php if (!$byTag): ?><p class="muted">No grievance tags logged yet.</p><?php endif; ?>
    <?php foreach ($byTag as $r): ?><div class="bar"><span><?= $h($tagLabels[$r['tag']] ?? $r['tag']) ?></span><i style="width:<?= max(4, (int)round($r['c'] / $maxTag * 100)) ?>%"></i><b><?= (int)$r['c'] ?></b></div><?php endforeach; ?>
  </section>

  <section class="panel"><div class="split"><h2>Review &amp; grievance inspector</h2>
    <div class="row"><a class="btn sm" href="api/export_csv.php?type=reviews">Export reviews CSV</a><a class="btn sm" href="api/export_csv.php?type=users">Export users CSV</a></div></div>
    <form class="filters" method="get"><input type="search" name="q" value="<?= $h($q) ?>" placeholder="Search biryani, user, email or text" aria-label="Search reviews">
      <label class="chk"><input type="checkbox" name="grievances" value="1" <?= $only ? 'checked' : '' ?>> Only grievances</label><button class="btn pri sm" type="submit">Filter</button></form>
    <div class="tw"><?php if (!$reviews): ?><p class="muted">No reviews match.</p><?php else: ?>
    <table><thead><tr><th>Date</th><th>User</th><th>Biryani</th><th>Rating</th><th>Highlights</th><th>Grievances</th><th>Areas to improve</th><th>Comments</th></tr></thead><tbody>
    <?php foreach ($reviews as $r): ?><tr>
      <td><?= $h(substr((string)$r['created_at'], 0, 16)) ?></td>
      <td><?= $h($r['uname']) ?><br><small><?= $h($r['email']) ?></small></td>
      <td><?= $h($r['biryani']) ?></td><td class="gold"><?= str_repeat('★', (int)$r['rating']) ?></td>
      <td><?= $h(str_replace(',', ', ', (string)$r['highlights'])) ?></td>
      <td><?php foreach (array_filter(explode(',', (string)$r['tags'])) as $tg): ?><span class="tag"><?= $h($tagLabels[$tg] ?? $tg) ?></span> <?php endforeach; ?></td>
      <td><?= $h($r['complaints_improvements']) ?></td><td><?= $h($r['comments']) ?></td></tr><?php endforeach; ?>
    </tbody></table><?php endif; ?></div></section>

  <section class="panel"><h2>Registered users</h2><div class="tw"><table><thead><tr><th>Sultan ID</th><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Last login</th></tr></thead><tbody>
    <?php foreach ($users as $u): ?><tr><td><?= $h($u['user_code']) ?></td><td><?= $h($u['name']) ?></td><td><?= $h($u['email']) ?></td>
      <td><?= (int)$u['is_admin'] === 1 ? '<span class="tag">Admin</span>' : 'Member' ?></td><td><?= $h(substr((string)$u['created_at'], 0, 10)) ?></td><td><?= $h($u['last_login'] ? substr((string)$u['last_login'], 0, 16) : '') ?></td></tr><?php endforeach; ?>
  </tbody></table></div></section>
</main></body></html>
