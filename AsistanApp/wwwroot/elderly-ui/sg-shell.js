(function () {
  const HEADER_ID = 'sgAppHeader';
  const A11Y_ID = 'a11yControls';

  function getActiveScreenId() {
    return document.querySelector('.screen.active')?.id || 'loginScreen';
  }

  function syncHeader() {
    const header = document.getElementById(HEADER_ID);
    if (!header) return;
    const screenId = getActiveScreenId();
    const showHeader = screenId === 'homeScreen';
    header.classList.toggle('is-hidden', !showHeader);
    document.body.classList.toggle('sg-on-home', showHeader);
    document.body.classList.toggle('sg-on-inner', !showHeader && screenId !== 'loginScreen' && screenId !== 'registerScreen');
  }

  function openSettings() {
    const wrap = document.getElementById(A11Y_ID);
    const menu = document.getElementById('a11yMenu');
    const btn = document.getElementById('a11yMenuBtn');
    if (!wrap || !menu) {
      console.warn('[SGShell] settings sheet missing');
      return false;
    }
    try { window.ignoreNextA11yClose = true; } catch (_) { /* ignore */ }
    wrap.classList.add('is-open');
    wrap.style.cssText = 'display:flex !important; pointer-events:auto !important; z-index:12050 !important;';
    menu.removeAttribute('hidden');
    menu.hidden = false;
    menu.style.cssText = 'display:flex !important; flex-direction:column; gap:10px;';
    if (btn) btn.setAttribute('aria-expanded', 'true');
    return true;
  }

  function closeSettings() {
    const wrap = document.getElementById(A11Y_ID);
    const menu = document.getElementById('a11yMenu');
    const btn = document.getElementById('a11yMenuBtn');
    if (!wrap || !menu) return;
    wrap.classList.remove('is-open');
    wrap.style.cssText = '';
    menu.setAttribute('hidden', '');
    menu.hidden = true;
    menu.style.cssText = '';
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function isSettingsOpen() {
    const wrap = document.getElementById(A11Y_ID);
    const menu = document.getElementById('a11yMenu');
    return Boolean(wrap?.classList.contains('is-open') && menu && !menu.hidden && !menu.hasAttribute('hidden'));
  }

  let lastToggleAt = 0;

  function toggleSettings(event) {
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
    }
    const now = Date.now();
    if (now - lastToggleAt < 400) return;
    lastToggleAt = now;
    if (isSettingsOpen()) closeSettings();
    else openSettings();
  }

  function bindSettingsSheet() {
    const wrap = document.getElementById(A11Y_ID);
    if (!wrap) return;
    if (!wrap.dataset.sgBackdropBound) {
      wrap.dataset.sgBackdropBound = '1';
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap) closeSettings();
      });
    }

    const bindTap = (el, handler) => {
      if (!el || el.dataset.sgTapBound) return;
      el.dataset.sgTapBound = '1';
      const run = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler(e);
      };
      el.addEventListener('click', run);
      el.addEventListener('touchend', (e) => {
        // iOS: avoid delayed/ghost click closing the sheet immediately
        e.preventDefault();
        run(e);
      }, { passive: false });
    };

    bindTap(document.getElementById('sgMenuBtn'), toggleSettings);
    bindTap(document.getElementById('sgSettingsBtn'), toggleSettings);
    bindTap(document.getElementById('sgAccountBtn'), () => {
      if (typeof window.showScreen === 'function') window.showScreen('profileScreen');
    });
  }

  function syncBottomNav() {
    const nav = document.querySelector('.sg-bottom-nav');
    if (!nav) return;
    const screenId = getActiveScreenId();
    const hideOn = new Set([
      'loginScreen',
      'registerScreen',
      'emergencyResultScreen',
      'addMedicationScreen',
      'addFamilyScreen'
    ]);
    const show = !hideOn.has(screenId);
    nav.classList.toggle('is-visible', show);
    document.body.classList.toggle('sg-hide-bottom-nav', !show);
    nav.querySelectorAll('.sg-bottom-nav-item').forEach((btn, idx) => {
      const active = (screenId === 'homeScreen' && idx === 0)
        || ((screenId === 'familyScreen' || screenId === 'addFamilyScreen') && idx === 1)
        || ((screenId === 'profileScreen' || screenId === 'subscriptionScreen') && idx === 2);
      btn.classList.toggle('is-active', active);
    });
  }

  function patchShowScreen() {
    if (typeof window.showScreen !== 'function' || window.showScreen.__sgPatched) return;
    const original = window.showScreen;
    window.showScreen = function (screenId) {
      original(screenId);
      closeSettings();
      syncHeader();
      syncBottomNav();
      if (typeof window.updateA11yControlsVisibility === 'function') {
        window.updateA11yControlsVisibility(screenId);
      }
    };
    window.showScreen.__sgPatched = true;
  }

  function patchToggleA11y() {
    window.toggleA11yMenu = function (event) {
      toggleSettings(event);
    };
    window.toggleA11yMenu.__sgPatched = true;
  }

  function ensureCloseButton() {
    const menu = document.getElementById('a11yMenu');
    if (!menu) return;
    let closeBtn = menu.querySelector('#sgSettingsCloseBtn');
    if (!closeBtn) {
      closeBtn = document.createElement('button');
      closeBtn.id = 'sgSettingsCloseBtn';
      closeBtn.type = 'button';
      closeBtn.className = 'btn-small btn-blue a11y-btn';
      closeBtn.setAttribute('data-i18n', 'settingsCloseBtn');
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeSettings();
      });
      menu.appendChild(closeBtn);
    }
    const label = (typeof window.t === 'function' && window.t('settingsCloseBtn'))
      || (document.documentElement.lang === 'en' ? 'Close' : 'Kapat');
    closeBtn.textContent = label;
  }

  function init() {
    bindSettingsSheet();
    ensureCloseButton();
    patchShowScreen();
    patchToggleA11y();
    syncHeader();
    syncBottomNav();
    const obs = new MutationObserver(() => {
      syncHeader();
      syncBottomNav();
    });
    document.querySelectorAll('.screen').forEach((el) => {
      obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SGShell = { openSettings, closeSettings, toggleSettings, syncHeader, ensureCloseButton };
})();
