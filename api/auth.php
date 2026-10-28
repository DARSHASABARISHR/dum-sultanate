<?php
require 'db.php'; session_start();
$in = body(); $a = $in['action'] ?? '';
function sultan_id(PDO $p): string { do { $id = 'SULTAN-USR-' . random_int(1000, 9999); $s = $p->prepare('SELECT 1 FROM users WHERE user_id=?'); $s->execute([$id]); } while ($s->fetch()); return $id; }
function login(PDO $p, string $name, string $email, string $prov, ?string $avatar): array {
  $s = $p->prepare('SELECT * FROM users WHERE email=?'); $s->execute([$email]); $u = $s->fetch();
  if (!$u) { $p->prepare('INSERT INTO users(user_id,name,email,avatar_url,auth_provider,is_verified) VALUES(?,?,?,?,?,1)')->execute([sultan_id($p), $name, $email, $avatar, $prov]);
    $s->execute([$email]); $u = $s->fetch(); }
  session_regenerate_id(true); $_SESSION['uid'] = (int)$u['id']; return $u;
}
$p = db();
if ($a === 'send_otp') {
  $name = trim($in['name'] ?? ''); $email = strtolower(trim($in['email'] ?? ''));
  if (strlen($name) < 2 || !filter_var($email, FILTER_VALIDATE_EMAIL)) out(['error' => 'Invalid name or email'], 422);
  if (!($in['robot'] ?? false) || (int)($in['ca'] ?? 0) + (int)($in['cb'] ?? 0) !== (int)($in['cans'] ?? -1)) out(['error' => 'CAPTCHA failed'], 422);
  $code = (string)random_int(100000, 999999);
  $p->prepare('DELETE FROM otp_codes WHERE email=?')->execute([$email]);
  $p->prepare('INSERT INTO otp_codes(email,code_hash,name,expires_at) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 5 MINUTE))')->execute([$email, password_hash($code, PASSWORD_DEFAULT), $name]);
  @mail($email, 'Your Dum Sultanate code', "Your verification code is $code. It expires in 5 minutes.", 'From: no-reply@dumsultanate.example');
  out(['ok' => true]);
}
if ($a === 'verify_otp') {
  $email = strtolower(trim($in['email'] ?? '')); $s = $p->prepare('SELECT * FROM otp_codes WHERE email=? AND expires_at>NOW()'); $s->execute([$email]); $r = $s->fetch();
  if (!$r || $r['attempts'] >= 5) out(['error' => 'Code expired. Request a new one.'], 410);
  if (!password_verify((string)($in['code'] ?? ''), $r['code_hash'])) { $p->prepare('UPDATE otp_codes SET attempts=attempts+1 WHERE id=?')->execute([$r['id']]); out(['error' => 'Incorrect code'], 401); }
  $p->prepare('DELETE FROM otp_codes WHERE email=?')->execute([$email]);
  $u = login($p, $r['name'], $email, 'email', null); out(['user' => $u]);
}
if ($a === 'google') {
  $j = json_decode(@file_get_contents('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($in['credential'] ?? '')), true);
  if (!$j || ($j['aud'] ?? '') !== GOOGLE_CLIENT_ID || ($j['email_verified'] ?? '') !== 'true') out(['error' => 'Google token rejected'], 401);
  out(['user' => login($p, $j['name'] ?? 'Foodie', strtolower($j['email']), 'google', $j['picture'] ?? null)]);
}
out(['error' => 'Unknown action'], 400);
