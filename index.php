<?php
declare(strict_types=1);
require __DIR__ . '/config/db.php';

$user  = current_user();
$csrf  = csrf_token();
$nonce = base64_encode(random_bytes(16));

header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-$nonce' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'");
header('Cross-Origin-Opener-Policy: same-origin-allow-popups');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-store');

$boot = [
    'user' => $user ? [
        'user_code' => $user['user_code'], 'name' => $user['name'], 'email' => $user['email'],
        'picture' => $user['avatar_url'], 'is_admin' => ((int)$user['is_admin'] === 1),
    ] : null,
    'csrf' => $csrf,
    'clientId' => GOOGLE_CLIENT_ID,
];
$h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DUM SULTANATE | House of Royal Biryani</title>
<meta name="description" content="Royal biryani recipes with Tamil and English voice-guided cooking.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Mulish:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&display=swap">
<link rel="stylesheet" href="assets/css/style.css">
<script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="nav">
  <a class="brand" href="index.php">DUM SULTANATE</a>
  <nav class="tabs" aria-label="Main">
    <button data-view="menu" class="on" data-i18n="nav_menu">Biryanis</button>
    <button data-view="favs" data-i18n="nav_favs">My Royal Favorites</button>
    <button data-view="review" data-i18n="nav_review">Review</button>
    <?php if ($user && (int)$user['is_admin'] === 1): ?><a class="tablink" href="admin.php" data-i18n="nav_admin">Admin</a><?php endif; ?>
  </nav>
  <div class="navr">
    <button class="btn sm" id="langBtn" data-i18n="lang_btn" aria-label="Language">தமிழ்</button>
    <?php if ($user): ?>
      <span class="me"><?php if ($user['avatar_url']): ?><img src="<?= $h($user['avatar_url']) ?>" alt="" referrerpolicy="no-referrer" width="30" height="30"><?php endif; ?>
      <span class="me-t"><b><?= $h($user['name']) ?></b><small><?= $h($user['user_code']) ?></small></span></span>
      <button class="btn sm" data-act="logout" data-i18n="sign_out">Sign out</button>
    <?php else: ?>
      <div class="gsi-slot" id="gsiHead"></div>
    <?php endif; ?>
  </div>
</header>

<main id="main">
<section class="view on" id="v-menu">
  <div class="hero">
    <div class="hero-copy">
      <p class="kicker" data-i18n="tagline">House of Royal Biryani, Connoisseur Recipes &amp; Foodie Archives</p>
      <h1>DUM<br>SULTANATE</h1>
      <p class="sub" data-i18n="hero_sub">Royal biryanis from across the South and beyond.</p>
      <div class="row">
        <a class="btn pri" href="#grid" data-i18n="hero_cta1">Explore recipes</a>
        <button class="btn" data-view="review" data-i18n="hero_cta2">Write a review</button>
      </div>
      <div class="stats">
        <div><b id="statCount">0</b><span data-i18n="stat_recipes">royal biryanis</span></div>
        <div><b id="statSteps">0</b><span data-i18n="stat_steps">guided steps each</span></div>
        <div><b>தமிழ் · EN</b><span data-i18n="stat_voice">Tamil &amp; English voice</span></div>
      </div>
    </div>
    <div class="seal" aria-hidden="true">
      <svg viewBox="0 0 300 300" class="ring"><defs><path id="circ" d="M150,150 m-118,0 a118,118 0 1,1 236,0 a118,118 0 1,1 -236,0"/></defs>
        <text><textPath href="#circ" startOffset="0">DUM SULTANATE ✦ HOUSE OF ROYAL BIRYANI ✦ SLOW · SEALED · ROYAL ✦ </textPath></text></svg>
      <div class="seal-core"><i class="steam s1"></i><i class="steam s2"></i><i class="steam s3"></i><span>தம்</span></div>
    </div>
  </div>
  <div class="searchbar" id="grid">
    <input id="q" type="search" autocomplete="off" data-i18n-ph="search_ph" placeholder="Search" aria-label="Search biryanis">
    <button class="mic" id="micBtn" type="button" aria-pressed="false" aria-label="Voice search">🎤</button>
    <span class="micstat" id="micStat" role="status"></span>
  </div>
  <div class="grid" id="cards"></div>
</section>

<section class="view" id="v-favs">
  <h2 class="vh" data-i18n="fav_title">My Royal Favorites</h2>
  <?php if ($user): ?><div id="favBox"></div>
  <?php else: ?><div class="empty gate"><p data-i18n="need_login">Sign in with Google to use this.</p><div class="gsi-slot"></div></div><?php endif; ?>
</section>

<section class="view" id="v-review">
  <h2 class="vh" data-i18n="review_title">Review &amp; Grievance Desk</h2>
  <?php if ($user): ?>
  <form class="panel" id="revForm" novalidate>
    <div class="field"><label for="rb" data-i18n="r_style">Biryani style</label><select id="rb" required></select></div>
    <div class="field"><span class="lab" data-i18n="r_rating">Rating</span>
      <div class="stars" id="stars" role="group" aria-label="Rating"><?php for ($i = 1; $i <= 5; $i++): ?><button type="button" data-star="<?= $i ?>" aria-pressed="false" aria-label="<?= $i ?>">★</button><?php endfor; ?></div></div>
    <div class="field"><span class="lab" data-i18n="r_highlights">Flavor highlights</span>
      <div class="chips"><?php foreach (['aroma' => 'h_aroma', 'rice_texture' => 'h_rice', 'meat_softness' => 'h_meat', 'spiciness' => 'h_spice', 'dalcha' => 'h_dalcha'] as $k => $i18n): ?>
        <button type="button" class="chip" data-hi="<?= $k ?>" aria-pressed="false" data-i18n="<?= $i18n ?>"></button><?php endforeach; ?></div></div>
    <div class="field"><span class="lab" data-i18n="r_grievances">What went wrong?</span>
      <div class="chips"><?php foreach (['excess_oil' => 'g_oil', 'overcooked_rice' => 'g_rice', 'unbalanced_spices' => 'g_spice', 'too_spicy' => 'g_hot', 'undercooked_meat' => 'g_meat', 'too_salty' => 'g_salt'] as $k => $i18n): ?>
        <button type="button" class="chip warn" data-gr="<?= $k ?>" aria-pressed="false" data-i18n="<?= $i18n ?>"></button><?php endforeach; ?></div></div>
    <div class="field"><label for="rc" data-i18n="r_improve">குறைகள் / Areas to Improve</label><textarea id="rc" rows="3" maxlength="2000" data-i18n-ph="r_improve_ph"></textarea></div>
    <div class="field"><label for="rt" data-i18n="r_comments">Detailed tasting comments</label><textarea id="rt" rows="4" maxlength="2000"></textarea></div>
    <button class="btn pri" id="rsub" type="submit" data-i18n="r_submit">Submit review</button>
  </form>
  <?php else: ?><div class="empty gate"><p data-i18n="need_login">Sign in with Google to use this.</p><div class="gsi-slot"></div><small data-i18n="signin_hint"></small></div><?php endif; ?>
</section>
</main>

<footer class="foot"><span data-i18n="footer">DUM SULTANATE. Cooked slow, sealed tight.</span></footer>

<div class="modal" id="mRecipe" role="dialog" aria-modal="true" aria-label="Recipe">
  <div class="sheet"><button class="x" data-act="close" data-i18n-aria="close" aria-label="Close">×</button><div id="recipeBody"></div></div>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script nonce="<?= $nonce ?>">window.DS = <?= json_encode($boot, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE) ?>;</script>
<script src="assets/js/translations.js"></script>
<script src="assets/js/voice.js"></script>
<script src="assets/js/app.js"></script>
</body>
</html>
