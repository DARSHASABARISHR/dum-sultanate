<?php
// Edit credentials, or set them as environment variables.
const GOOGLE_CLIENT_ID = '';           // your OAuth 2.0 client ID
const ADMIN_KEY = 'change-this-key';   // admin_dashboard.php?key=...
function db(): PDO {
  static $p = null;
  if (!$p) $p = new PDO('mysql:host=localhost;dbname=dum_sultanate;charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
  return $p;
}
function out($d, int $c = 200) { http_response_code($c); header('Content-Type: application/json'); echo json_encode($d); exit; }
function body(): array { return json_decode(file_get_contents('php://input'), true) ?: []; }
