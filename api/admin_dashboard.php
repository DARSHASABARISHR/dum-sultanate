<?php
require 'db.php';
if (!hash_equals(ADMIN_KEY, $_GET['key'] ?? '')) out(['error' => 'Forbidden'], 403);
$p = db();
if (isset($_GET['export'])) {
  $t = $_GET['export'] === 'users' ? 'SELECT user_id,name,email,auth_provider,is_verified,created_at FROM users'
     : 'SELECT u.user_id,r.biryani_name,r.rating,r.highlights,r.complaints_improvements,r.comments,r.created_at FROM reviews r JOIN users u ON u.id=r.user_id';
  header('Content-Type: text/csv'); header('Content-Disposition: attachment; filename="' . $_GET['export'] . '.csv"');
  $o = fopen('php://output', 'w'); $first = true;
  foreach ($p->query($t) as $row) { if ($first) { fputcsv($o, array_keys($row)); $first = false; } fputcsv($o, $row); }
  exit;
}
$q = '%' . ($_GET['q'] ?? '') . '%'; $only = !empty($_GET['grievances']) ? " AND r.complaints_improvements<>''" : '';
$rs = $p->prepare("SELECT r.*,u.name,u.email FROM reviews r JOIN users u ON u.id=r.user_id WHERE (r.biryani_name LIKE ? OR r.complaints_improvements LIKE ? OR r.comments LIKE ?)$only ORDER BY r.created_at DESC LIMIT 500");
$rs->execute([$q, $q, $q]);
out([
  'kpis' => [
    'users' => (int)$p->query('SELECT COUNT(*) FROM users')->fetchColumn(),
    'google_signins' => (int)$p->query("SELECT COUNT(*) FROM users WHERE auth_provider='google'")->fetchColumn(),
    'most_loved' => $p->query('SELECT b.name,COUNT(*) c FROM favorites f JOIN biryanis b ON b.id=f.biryani_id GROUP BY b.id ORDER BY c DESC LIMIT 1')->fetch() ?: null,
    'grievances' => (int)$p->query("SELECT COUNT(*) FROM reviews WHERE complaints_improvements<>''")->fetchColumn()],
  'users' => $p->query('SELECT user_id,name,email,auth_provider,created_at FROM users WHERE is_verified=1 ORDER BY created_at DESC')->fetchAll(),
  'reviews' => $rs->fetchAll()]);
