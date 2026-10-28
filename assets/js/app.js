'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const DS = window.DS;
  const t = k => I18N.t(k);
  const S = { list: [], favs: new Set(), view: 'menu', cur: null, rv: { rating: 0, hi: new Set(), gr: new Set() }, gsi: false };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastTimer;
  function toast(msg, ms = 4500) {
    const e = $('#toast');
    e.textContent = msg; e.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => e.classList.remove('on'), ms);
  }
  const errMsg = e => t(e && e.key ? e.key : 'err_generic');

  async function api(path, { method = 'GET', body } = {}) {
    const headers = { Accept: 'application/json' };
    if (method === 'POST') { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = DS.csrf; }
    let res;
    try { res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' }); }
    catch (e) { throw { key: 'err_network' }; }
    let json = null;
    try { json = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (!res.ok || !json || !json.ok) throw { key: res.status === 401 ? 'err_login' : 'err_generic', status: res.status, data: json };
    return json;
  }

  /* ---------- Data + grid ---------- */
  async function loadList() {
    const j = await api('api/get_biryanis.php');
    S.list = j.biryanis; S.favs = new Set(j.favorites);
    const n = S.list.length;
    $('#statCount').textContent = n;
    $('#statSteps').textContent = n ? S.list[0].steps.length : 0;
    fillSelect();
  }

  function cardHTML(b) {
    const L = I18N.localize(b), f = S.favs.has(b.id);
    const rate = b.review_count > 0 ? `<span class="rate">★ ${b.avg_rating} <small>(${b.review_count})</small></span>` : '';
    return `<article class="card"><span class="mark" aria-hidden="true">${esc(Array.from(L.name)[0])}</span>
      <div class="card-top"><span class="region">${esc(L.region)}</span>${rate}</div>
      <h3>${esc(L.name)}</h3><p>${esc(L.description)}</p>
      <div class="times"><span>${t('prep')} ${b.prep_time} ${t('mins')}</span><span>${t('cook')} ${b.cook_time} ${t('mins')}</span></div>
      <div class="row"><button class="btn pri sm" data-act="open" data-id="${b.id}">${t('view_recipe')}</button>
      <button class="btn sm heart ${f ? 'on' : ''}" data-act="fav" data-id="${b.id}" aria-pressed="${f}">${f ? '❤️ ' + t('saved_fav') : '🤍 ' + t('add_fav')}</button></div></article>`;
  }

  function renderGrid() {
    const q = $('#q').value.trim().toLowerCase();
    const l = S.list.filter(b => !q || I18N.searchText(b).includes(q));
    $('#cards').innerHTML = l.length ? l.map(cardHTML).join('') : `<div class="empty wide">${esc(t('no_results'))}</div>`;
  }
  function renderFavs() {
    const box = $('#favBox'); if (!box) return;
    const l = S.list.filter(b => S.favs.has(b.id));
    box.innerHTML = l.length ? `<div class="grid">${l.map(cardHTML).join('')}</div>` : `<div class="empty">${esc(t('fav_empty'))}</div>`;
  }
  function fillSelect() {
    const sel = $('#rb'); if (!sel) return;
    const keep = sel.value;
    sel.innerHTML = S.list.map(b => `<option value="${b.id}">${esc(I18N.localize(b).name)}</option>`).join('');
    if (keep) sel.value = keep;
  }

  /* ---------- Views ---------- */
  function setView(v) {
    S.view = v;
    $$('.view').forEach(e => e.classList.toggle('on', e.id === 'v-' + v));
    $$('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    if (v === 'favs') renderFavs();
    renderGsi();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Favorites ---------- */
  async function toggleFav(id) {
    if (!DS.user) { toast(t('need_login')); $('#gsiHead').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    try {
      const j = await api('api/toggle_favorite.php', { method: 'POST', body: { biryani_id: id } });
      j.favorited ? S.favs.add(id) : S.favs.delete(id);
      renderGrid(); renderFavs(); if (S.cur) renderRecipe();
    } catch (e) { toast(errMsg(e)); }
  }

  /* ---------- Recipe modal + voice guide ---------- */
  function openRecipe(id) {
    const b = S.list.find(x => x.id === id); if (!b) return;
    S.cur = b; renderRecipe();
    $('#mRecipe').classList.add('on'); document.body.classList.add('lock');
    $('#mRecipe .x').focus();
  }
  function closeRecipe() {
    Voice.guide.stop(); S.cur = null;
    $('#mRecipe').classList.remove('on'); document.body.classList.remove('lock');
  }
  function renderRecipe() {
    const b = S.cur, L = I18N.localize(b), f = S.favs.has(b.id);
    const prevText = I18N.lang === 'ta' ? 'முந்தைய படி' : 'Previous';
    $('#recipeBody').innerHTML = `
      <p class="region">${esc(L.region)} · ${t('prep')} ${b.prep_time} ${t('mins')} · ${t('cook')} ${b.cook_time} ${t('mins')}</p>
      <h2>${esc(L.name)}</h2><p class="lead">${esc(L.description)}</p>
      <div class="row"><button class="btn sm heart ${f ? 'on' : ''}" data-act="fav" data-id="${b.id}">${f ? '❤️ ' + t('saved_fav') : '🤍 ' + t('add_fav')}</button></div>
      <div class="voicebar"><span class="vt">🎙️ ${t('voice_guide')}</span>
        <button class="rbtn" data-act="vprev" aria-label="${prevText}" title="${prevText}">⏮</button>
        <button class="rbtn pri" data-act="vplay" aria-label="${t('play')}" title="${t('play')}">▶</button>
        <button class="rbtn" data-act="vpause" aria-label="${t('pause')}" title="${t('pause')}">⏸</button>
        <button class="rbtn" data-act="vnext" aria-label="${t('next')}" title="${t('next')}">⏭</button>
        <button class="rbtn" data-act="vstop" aria-label="${t('stop')}" title="${t('stop')}">⏹</button>
        <span class="vstat" id="vstat" role="status"></span></div>
      <div class="cols"><div class="ing" id="rIng"><h3>${t('ingredients')}</h3>${L.ingredients.map(x => `<label><input type="checkbox"><span>${esc(x)}</span></label>`).join('')}</div>
      <div><h3>${t('steps')}</h3><ol class="steps" id="rSteps">${L.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div></div>`;
    const lines = [t('ingredients') + '. ' + L.ingredients.join('. '), ...L.steps.map((s, i) => t('step_word') + ' ' + (i + 1) + '. ' + s)];
    Voice.guide.load(lines, I18N.lang === 'ta' ? 'ta-IN' : 'en-IN', markActive);
  }
  function markActive(i, state) {
    const ing = $('#rIng'); if (!ing) return;
    ing.classList.toggle('active', i === 0 && state !== 'stop');
    $$('#rSteps li').forEach((li, k) => li.classList.toggle('active', k === i - 1 && state !== 'stop'));
    const vs = $('#vstat'); if (vs) vs.textContent = state === 'play' ? t('v_reading') : state === 'pause' ? t('v_paused') : '';
    const el = i === 0 ? ing : $$('#rSteps li')[i - 1];
    if (el && state === 'play') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function vPlay() {
    const r = Voice.guide.play();
    if (!r.supported) return toast(t('voice_unsupported'));
    if (I18N.lang === 'ta' && !r.voiceFound) toast(t('voice_missing'), 8000);
  }

  /* ---------- Google Identity Services ---------- */
  async function onCredential(resp) {
    try {
      const j = await api('api/google_auth.php', { method: 'POST', body: { credential: resp.credential } });
      location.href = j.redirect || 'index.php';
    } catch (e) { toast(e && e.status === 401 ? t('err_signin') : errMsg(e)); }
  }
  function renderGsi() {
    if (!S.gsi || DS.user) return;
    $$('.gsi-slot').forEach(el => {
      el.innerHTML = '';
      google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', logo_alignment: 'left', locale: I18N.lang === 'ta' ? 'ta' : 'en' });
    });
  }
  function initGoogle(tries = 0) {
    if (DS.user) return;
    if (!(window.google && google.accounts && google.accounts.id)) {
      if (tries > 60) return toast(t('err_google'), 8000);
      return setTimeout(() => initGoogle(tries + 1), 250);
    }
    google.accounts.id.initialize({ client_id: DS.clientId, callback: onCredential, auto_select: false, cancel_on_tap_outside: true });
    S.gsi = true; renderGsi();
  }
  async function logout() {
    try { await api('api/logout.php', { method: 'POST', body: {} }); } catch (e) { /* session may already be gone */ }
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
    location.href = 'index.php';
  }

  /* ---------- Reviews ---------- */
  function setupReview() {
    const form = $('#revForm'); if (!form) return;
    $$('#stars button').forEach(b => b.addEventListener('click', () => {
      S.rv.rating = +b.dataset.star;
      $$('#stars button').forEach(x => { const on = +x.dataset.star <= S.rv.rating; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    }));
    $$('.chip[data-hi]').forEach(c => c.addEventListener('click', () => { c.classList.toggle('on'); c.setAttribute('aria-pressed', c.classList.contains('on')); c.classList.contains('on') ? S.rv.hi.add(c.dataset.hi) : S.rv.hi.delete(c.dataset.hi); }));
    $$('.chip[data-gr]').forEach(c => c.addEventListener('click', () => { c.classList.toggle('on'); c.setAttribute('aria-pressed', c.classList.contains('on')); c.classList.contains('on') ? S.rv.gr.add(c.dataset.gr) : S.rv.gr.delete(c.dataset.gr); }));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!S.rv.rating) return toast(t('r_need_rating'));
      const btn = $('#rsub'); btn.disabled = true;
      try {
        await api('api/submit_review.php', { method: 'POST', body: { biryani_id: +$('#rb').value, rating: S.rv.rating, highlights: [...S.rv.hi], grievances: [...S.rv.gr], complaints: $('#rc').value.trim(), comments: $('#rt').value.trim() } });
        toast(t('r_thanks'));
        form.reset(); S.rv = { rating: 0, hi: new Set(), gr: new Set() };
        $$('#stars button, .chip').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
        await loadList(); renderGrid(); fillSelect();
      } catch (err) { toast(errMsg(err)); }
      finally { btn.disabled = false; }
    });
  }

  /* ---------- Wiring ---------- */
  function wire() {
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      const id = +a.dataset.id;
      ({
        open: () => openRecipe(id),
        fav: () => toggleFav(id),
        close: closeRecipe,
        vprev: () => Voice.guide.prev(),
        vplay: vPlay,
        vpause: () => Voice.guide.pause(),
        vnext: () => Voice.guide.next(),
        vstop: () => Voice.guide.stop(),
        logout
      }[a.dataset.act] || (() => {}))();
    });
    $$('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
    $('#mRecipe').addEventListener('click', e => { if (e.target.id === 'mRecipe') closeRecipe(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.cur) closeRecipe(); });
    $('#q').addEventListener('input', renderGrid);
    $('#langBtn').addEventListener('click', () => I18N.setLang(I18N.lang === 'ta' ? 'en' : 'ta'));

    Voice.search.init({
      input: $('#q'), button: $('#micBtn'),
      getLang: () => (I18N.lang === 'ta' ? 'ta-IN' : 'en-IN'),
      onState: on => { const m = $('#micBtn'); m.classList.toggle('rec', on); m.setAttribute('aria-pressed', on); m.title = on ? t('mic_on') : t('mic_off'); $('#micStat').textContent = on ? t('listening') : ''; },
      onError: k => toast(t(k === 'unsupported' ? 'mic_unsupported' : k === 'denied' ? 'mic_denied' : 'mic_error'), 7000)
    });

    document.addEventListener('langchange', () => {
      const wasListening = Voice.search.isOn();
      if (wasListening) Voice.search.stop();
      renderGrid(); renderFavs(); fillSelect();
      if (S.cur) { Voice.guide.stop(); renderRecipe(); }
      $('#micBtn').title = t('mic_off');
      renderGsi();
      if (wasListening) Voice.search.start();
    });
  }

  async function boot() {
    I18N.apply(); wire(); setupReview();
    $('#micBtn').title = t('mic_off');
    initGoogle();
    $('#cards').innerHTML = `<div class="empty wide">${esc(t('loading'))}</div>`;
    try { await loadList(); renderGrid(); renderFavs(); }
    catch (e) { $('#cards').innerHTML = `<div class="empty wide">${esc(t('load_failed'))}</div>`; }
  }
  document.addEventListener('DOMContentLoaded', boot);
})();