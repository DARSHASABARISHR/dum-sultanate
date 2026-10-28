<?php
declare(strict_types=1);
require __DIR__ . '/../config/db.php';
start_secure_session();
if (empty($_SESSION['is_admin']) || $_SESSION['is_admin'] !== true) {
    http_response_code(403);
    exit('Access Denied');
}

$type = $_GET['type'] ?? '';
if ($type === 'users') {
    $sql = 'SELECT user_code, name, email, is_admin, created_at, last_login FROM users ORDER BY id';
} elseif ($type === 'reviews') {
    $sql = 'SELECT r.id, u.user_code, u.name AS user_name, u.email, b.name AS biryani, r.rating, r.highlights,
                   (SELECT GROUP_CONCAT(g.tag SEPARATOR ",") FROM review_grievances g WHERE g.review_id = r.id) AS grievance_tags,
                   r.complaints_improvements, r.comments, r.created_at
              FROM reviews r JOIN users u ON u.id = r.user_id JOIN biryanis b ON b.id = r.biryani_id
             ORDER BY r.id';
} else {
    http_response_code(400);
    exit('Unknown export type');
}

$safe = static function ($v) {
    if (is_string($v) && $v !== '' && preg_match('/^[=+\-@\t\r]/', $v)) {
        return "'" . $v;   // neutralise spreadsheet formula injection
    }
    return $v;
};

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="dum-sultanate-' . $type . '-' . date('Ymd-His') . '.csv"');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF");   // UTF-8 BOM so Excel shows Tamil correctly
$stmt = db()->query($sql);
$first = true;
while ($row = $stmt->fetch()) {
    if ($first) {
        fputcsv($out, array_keys($row), ',', '"', '');
        $first = false;
    }
    fputcsv($out, array_map($safe, array_values($row)), ',', '"', '');
}
if ($first) {
    fputcsv($out, ['no_rows'], ',', '"', '');
}
fclose($out);
