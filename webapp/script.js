/* HireSky webapp interactions */
(function () {
  'use strict';

  var el = function (id) { return document.getElementById(id); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Nav: scroll state + mobile menu ---------- */
  var nav = el('nav');
  var onScroll = function () {
    if (window.scrollY > 12) { nav.classList.add('scrolled'); }
    else { nav.classList.remove('scrolled'); }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var menuBtn = el('menu-btn');
  var mobileMenu = el('mobile-menu');
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (mobileMenu) { mobileMenu.hidden = !open; }
    });
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-label', 'Open menu');
        mobileMenu.hidden = true;
      });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealTargets = document.querySelectorAll('.card, .step, .faq details, .platform, .install-list li, .section-title, .section-sub');
  if ('IntersectionObserver' in window && !reduceMotion) {
    revealTargets.forEach(function (t) { t.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(function (t) { io.observe(t); });
  }

  /* ---------- Hero tilt ---------- */
  var tilt = el('tilt');
  var stage = tilt ? tilt.parentElement : null;
  if (tilt && stage && !reduceMotion && window.matchMedia('(hover: hover)').matches) {
    stage.addEventListener('mousemove', function (ev) {
      var r = stage.getBoundingClientRect();
      var px = (ev.clientX - r.left) / r.width;
      var py = (ev.clientY - r.top) / r.height;
      var rx = (py - 0.5) * -10;
      var ry = (px - 0.5) * 12;
      tilt.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
    });
    stage.addEventListener('mouseleave', function () {
      tilt.style.transition = 'transform .5s ease-out';
      tilt.style.transform = 'rotateX(0) rotateY(0)';
      setTimeout(function () { tilt.style.transition = 'transform .15s ease-out'; }, 500);
    });
  }

  /* ---------- Streaming code typing animation ---------- */
  var codeEl = el('type-code');
  if (codeEl && !reduceMotion) {
    var snippet =
      'int findDuplicate(vector<int>& nums) {\n' +
      '    int slow = nums[0], fast = nums[0];\n' +
      '    do {\n' +
      '        slow = nums[slow];\n' +
      '        fast = nums[nums[fast]];\n' +
      '    } while (slow != fast);\n' +
      '    return slow;\n' +
      '}';
    var i = 0;
    var typeNext = function () {
      codeEl.textContent = snippet.slice(0, i);
      i++;
      if (i <= snippet.length) {
        setTimeout(typeNext, 22 + Math.round(Math.sin(i) * 8) + 8);
      } else {
        setTimeout(function () { i = 0; typeNext(); }, 4200);
      }
    };
    typeNext();
  } else if (codeEl) {
    codeEl.textContent = 'int findDuplicate(vector<int>& nums) { ... }';
  }

  /* ---------- OS detection ---------- */
  function detectOS() {
    var ua = (navigator.userAgent || '').toLowerCase();
    var plat = (navigator.platform || '').toLowerCase();
    if (ua.indexOf('windows') !== -1 || plat.indexOf('win') !== -1) return 'windows';
    if (ua.indexOf('mac') !== -1 || plat.indexOf('mac') !== -1) return 'macos';
    if (ua.indexOf('linux') !== -1 || ua.indexOf('x11') !== -1) return 'linux-deb';
    return null;
  }

  /* ---------- Downloads (macOS pre-built today; Windows/Linux coming soon) ---------- */
  var MACOS_DOWNLOAD = {
    url: './downloads/HireSky-1.0.0-arm64.dmg',
    fileName: 'HireSky-1.0.0-arm64.dmg',
    version: '1.0.0',
    size: 761325862
  };

  function fmtBytes(b) {
    if (!b) return '';
    if (b < 1048576) return Math.round(b / 1024) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return ''; }
  }
  function icon(id) { return '<svg class="ic"><use href="#' + id + '"/></svg>'; }

  function comingSoonCard(label, iconId) {
    return '<div class="platform platform-soon">' +
      '<div class="platform-head">' + icon(iconId) + '<h4>' + label + '</h4></div>' +
      '<p class="pnote">Coming soon.</p>' +
      '<div class="dl-links"><span class="asset empty">Not available yet</span></div>' +
      '</div>';
  }

  function renderDownloads() {
    el('dl-version').innerHTML =
      '<span class="tag"><span class="dot"></span>v' + MACOS_DOWNLOAD.version + '</span>';

    var macCard =
      '<div class="platform">' +
        '<div class="platform-head">' + icon('i-apple') + '<h4>macOS</h4></div>' +
        '<p class="pnote">Apple Silicon (M1/M2/M3/M4). Unsigned build for now &mdash; right-click the app and choose "Open" the first time.</p>' +
        '<div class="dl-links">' +
          '<a class="asset" href="' + MACOS_DOWNLOAD.url + '" download>' +
            icon('i-download') +
            '<span class="meta"><span class="fname">' + MACOS_DOWNLOAD.fileName + '</span>' +
            '<span class="fsize">' + fmtBytes(MACOS_DOWNLOAD.size) + '</span></span>' +
            '<span class="go"><svg class="ic"><use href="#i-arrow"/></svg></span>' +
          '</a>' +
        '</div>' +
      '</div>';

    el('dl-grid').innerHTML = macCard +
      comingSoonCard('Windows', 'i-windows') +
      comingSoonCard('Linux', 'i-linux');

    var os = detectOS();
    var heroLbl = el('hero-dl-label');
    if (os === 'macos') {
      el('dl-recommend').innerHTML =
        '<div class="rec-left">' +
          '<span class="rec-ic">' + icon('i-apple') + '</span>' +
          '<span class="rec-text">' +
            '<span class="rec-label">You are on macOS</span>' +
            '<span class="rec-title">' + MACOS_DOWNLOAD.fileName + '</span>' +
            '<span class="rec-file">' + fmtBytes(MACOS_DOWNLOAD.size) + '</span>' +
          '</span>' +
        '</div>' +
        '<a class="btn btn-solid" href="' + MACOS_DOWNLOAD.url + '" download>' +
          icon('i-download') + 'Download</a>';
      el('dl-recommend').classList.remove('hidden');
      if (heroLbl) { heroLbl.textContent = 'Download for macOS'; }
    } else {
      if (heroLbl) { heroLbl.textContent = 'Download for macOS'; }
    }

    el('dl-loading').classList.add('hidden');
    el('dl-version').classList.remove('hidden');
    el('dl-grid').classList.remove('hidden');

    if ('IntersectionObserver' in window && !reduceMotion) {
      el('dl-grid').querySelectorAll('.platform').forEach(function (p) {
        p.classList.add('reveal');
        var o = new IntersectionObserver(function (en) {
          en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); o.unobserve(x.target); } });
        }, { threshold: 0.1 });
        o.observe(p);
      });
    }
  }

  renderDownloads();
})();
