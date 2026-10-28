<?php
declare(strict_types=1);
require __DIR__ . '/../config/db.php';
api_boot('POST');
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $c = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 42000, 'path' => $c['path'], 'secure' => $c['secure'], 'httponly' => true, 'samesite' => 'Lax']);
}
session_destroy();
json_out(['ok' => true, 'redirect' => 'index.php']);
