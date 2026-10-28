# DUM SULTANATE (XAMPP setup)

1. Copy this folder to `C:\xampp\htdocs\dum-sultanate-pro` and start Apache + MySQL.
2. phpMyAdmin: import `database/schema.sql` (creates `dum_sultanate` and seeds all 20 biryanis).
3. Edit `config/db.php`: DB credentials, `GOOGLE_CLIENT_ID`, `ADMIN_EMAIL`.
4. Google Cloud Console > Credentials > OAuth client ID (Web). Add `http://localhost` and `http://localhost:80` to Authorised JavaScript origins.
5. If login fails with a curl SSL error: download https://curl.se/ca/cacert.pem, set `curl.cainfo` in `php.ini`, restart Apache.
6. Open http://localhost/dum-sultanate-pro/ . Voice search and Tamil voices work best in Chrome or Edge.

Regenerate the SQL after editing recipes: `node tools/build_schema.js`.
