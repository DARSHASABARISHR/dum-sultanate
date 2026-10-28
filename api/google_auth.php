<?php
declare(strict_types=1);
require __DIR__ . '/../config/db.php';

$in = api_boot('POST');

if (str_contains(GOOGLE_CLIENT_ID, 'YOUR_CLIENT_ID')) {
    json_out(['ok' => false, 'error' => 'server_not_configured'], 500);
}

$cred = $in['credential'] ?? '';
if (!is_string($cred) || strlen($cred) < 100 || strlen($cred) > 4096 || substr_count($cred, '.') !== 2) {
    json_out(['ok' => false, 'error' => 'invalid_token'], 400);
}

/** Ask Google to verify the signature and return the decoded payload. */
function google_tokeninfo(string $idToken): ?array
{
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken);
    $raw = false;
    $code = 0;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $raw = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($raw === false) {
            error_log('tokeninfo curl error: ' . curl_error($ch));
        }
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => ['timeout' => 10, 'ignore_errors' => true]]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw !== false && isset($http_response_header[0]) && preg_match('~\s(\d{3})\s~', $http_response_header[0], $m)) {
            $code = (int)$m[1];
        }
    }
    if ($raw === false || $code !== 200) {
        return null;
    }
    $p = json_decode($raw, true);
    return is_array($p) ? $p : null;
}

$p = google_tokeninfo($cred);
if ($p === null) {
    json_out(['ok' => false, 'error' => 'token_rejected'], 401);
}

$iss = $p['iss'] ?? '';
$verified = $p['email_verified'] ?? false;
if (
    !hash_equals(GOOGLE_CLIENT_ID, (string)($p['aud'] ?? ''))
    || !in_array($iss, ['accounts.google.com', 'https://accounts.google.com'], true)
    || (int)($p['exp'] ?? 0) <= time()
    || !($verified === true || $verified === 'true')
    || empty($p['sub']) || empty($p['email'])
) {
    json_out(['ok' => false, 'error' => 'token_invalid'], 401);
}

$sub   = (string)$p['sub'];
$email = strtolower((string)$p['email']);
$name  = mb_substr(trim((string)($p['name'] ?? strstr($email, '@', true))), 0, 190);
$pic   = isset($p['picture']) ? mb_substr((string)$p['picture'], 0, 512) : null;
$isAdmin = hash_equals(strtolower(ADMIN_EMAIL), $email) ? 1 : 0;

$pdo = db();
$sql = 'INSERT INTO users (user_code, google_sub, name, email, avatar_url, is_admin, last_login)
        VALUES (:code, :sub, :name, :email, :pic, :adm, NOW())
        ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), avatar_url = VALUES(avatar_url),
                                is_admin = VALUES(is_admin), last_login = NOW(), id = LAST_INSERT_ID(id)';
$stmt = $pdo->prepare($sql);
$userId = 0;
for ($try = 0; $try < 5; $try++) {
    try {
        $stmt->execute([
            ':code'  => 'SULTAN-USR-' . random_int(100000, 999999),
            ':sub'   => $sub,
            ':name'  => $name,
            ':email' => $email,
            ':pic'   => $pic,
            ':adm'   => $isAdmin,
        ]);
        $userId = (int)$pdo->lastInsertId();
        break;
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? 0) !== 1062 || $try === 4) {
            throw $e;
        }
    }
}

$u = $pdo->prepare('SELECT id, user_code, name, email, avatar_url, is_admin FROM users WHERE id = ?');
$u->execute([$userId]);
$user = $u->fetch();

session_regenerate_id(true);
$_SESSION['user_id']   = (int)$user['id'];
$_SESSION['email']     = $user['email'];
$_SESSION['is_admin']  = ((int)$user['is_admin'] === 1);
$_SESSION['csrf']      = bin2hex(random_bytes(32));
$_SESSION['last_seen'] = time();

json_out([
    'ok'       => true,
    'user'     => [
        'user_code' => $user['user_code'],
        'name'      => $user['name'],
        'email'     => $user['email'],
        'picture'   => $user['avatar_url'],
        'is_admin'  => $_SESSION['is_admin'],
    ],
    'csrf'     => $_SESSION['csrf'],
    'redirect' => 'index.php',
]);
