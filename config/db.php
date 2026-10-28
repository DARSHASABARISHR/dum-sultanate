<?php
declare(strict_types=1);

/* ---- EDIT THESE VALUES BEFORE DEPLOYING ---- */
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'dum_sultanate');
define('DB_USER', 'root');
define('DB_PASS', '');                       // XAMPP default is an empty password
define('GOOGLE_CLIENT_ID', '');
define('ADMIN_EMAIL', '');
/* -------------------------------------------- */

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    }
    return $pdo;
}

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    session_name('DUMSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    if (isset($_SESSION['last_seen']) && time() - (int)$_SESSION['last_seen'] > 7200) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['last_seen'] = time();
}

function csrf_token(): string
{
    start_secure_session();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function json_out(array $data, int $status = 200): never
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

/** Common guard for every JSON endpoint: method, same-origin, CSRF, login, JSON body. */
function api_boot(string $method = 'POST', bool $needLogin = false): array
{
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    set_exception_handler(function (Throwable $e): void {
        error_log((string)$e);
        json_out(['ok' => false, 'error' => 'server_error'], 500);
    });
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        json_out(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
    start_secure_session();
    $body = [];
    if ($method === 'POST') {
        if (!empty($_SERVER['HTTP_ORIGIN'])) {
            $o = parse_url($_SERVER['HTTP_ORIGIN']);
            $host = ($o['host'] ?? '') . (isset($o['port']) ? ':' . $o['port'] : '');
            if (!hash_equals(strtolower($_SERVER['HTTP_HOST'] ?? ''), strtolower($host))) {
                json_out(['ok' => false, 'error' => 'bad_origin'], 403);
            }
        }
        $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($sent) || !hash_equals((string)($_SESSION['csrf'] ?? ''), $sent)) {
            json_out(['ok' => false, 'error' => 'bad_csrf'], 403);
        }
        $raw = file_get_contents('php://input', false, null, 0, 65537);
        if ($raw === false || strlen($raw) > 65536) {
            json_out(['ok' => false, 'error' => 'payload_too_large'], 413);
        }
        $body = json_decode($raw === '' ? '{}' : $raw, true);
        if (!is_array($body)) {
            json_out(['ok' => false, 'error' => 'invalid_json'], 400);
        }
    }
    if ($needLogin && empty($_SESSION['user_id'])) {
        json_out(['ok' => false, 'error' => 'login_required'], 401);
    }
    return $body;
}

function current_user(): ?array
{
    start_secure_session();
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $s = db()->prepare('SELECT id, user_code, name, email, avatar_url, is_admin FROM users WHERE id = ?');
    $s->execute([(int)$_SESSION['user_id']]);
    $u = $s->fetch();
    if (!$u) {
        $_SESSION = [];
        session_regenerate_id(true);
        return null;
    }
    return $u;
}
