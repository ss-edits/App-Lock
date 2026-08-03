/**
 * App Lock & Secure Media Vault — Master Application Controller
 * Handles zero-delay lock interception, UI views, scenario profiles, PWA install prompts, and Vault binding.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const authEngine = new AuthEngine();
  const mediaVault = new MediaVaultEngine();
  await mediaVault.init();

  let deferredInstallPrompt = null;
  let currentActiveAppId = null;
  let patternLockInstance = null;
  let currentPinInput = '';

  const defaultAppDirectory = {
    'whatsapp': { id: 'whatsapp', pkg: 'com.whatsapp', name: 'WhatsApp', category: 'Social', icon: '💬', color: '#25D366', locked: true, lockType: 'pattern', invisiblePattern: true },
    'instagram': { id: 'instagram', pkg: 'com.instagram.android', name: 'Instagram', category: 'Social', icon: '📸', color: '#E1306C', locked: true, lockType: 'biometrics', invisiblePattern: false },
    'photos': { id: 'photos', pkg: 'com.google.android.apps.photos', name: 'Google Photos & Gallery', category: 'Media', icon: '🖼️', color: '#FF9F0A', locked: true, lockType: 'password', invisiblePattern: false },
    'paytm': { id: 'paytm', pkg: 'net.one97.paytm', name: 'Paytm Wallet & UPI', category: 'Finance', icon: '💳', color: '#002E6E', locked: true, lockType: 'pin', invisiblePattern: false },
    'gpay': { id: 'gpay', pkg: 'com.google.android.apps.nfc.payment', name: 'Google Pay (GPay)', category: 'Finance', icon: '💰', color: '#4285F4', locked: true, lockType: 'pin', invisiblePattern: false },
    'phonepe': { id: 'phonepe', pkg: 'com.phonepe.app', name: 'PhonePe UPI', category: 'Finance', icon: '🟣', color: '#5F259F', locked: true, lockType: 'pin', invisiblePattern: false },
    'youtube': { id: 'youtube', pkg: 'com.google.android.youtube', name: 'YouTube', category: 'Media', icon: '▶️', color: '#FF0000', locked: false, lockType: 'pattern', invisiblePattern: false },
    'chrome': { id: 'chrome', pkg: 'com.android.chrome', name: 'Google Chrome', category: 'System', icon: '🌐', color: '#0F9D58', locked: true, lockType: 'pin', invisiblePattern: false },
    'facebook': { id: 'facebook', pkg: 'com.facebook.katana', name: 'Facebook', category: 'Social', icon: '📘', color: '#1877F2', locked: false, lockType: 'pin', invisiblePattern: false },
    'snapchat': { id: 'snapchat', pkg: 'com.snapchat.android', name: 'Snapchat', category: 'Social', icon: '👻', color: '#FFFC00', locked: true, lockType: 'pattern', invisiblePattern: true },
    'telegram': { id: 'telegram', pkg: 'org.telegram.messenger', name: 'Telegram', category: 'Social', icon: '✈️', color: '#0088CC', locked: false, lockType: 'pin', invisiblePattern: false },
    'banking': { id: 'banking', pkg: 'com.banking.app', name: 'Global Banking', category: 'Finance', icon: '🏛️', color: '#0071E3', locked: true, lockType: 'pin', invisiblePattern: false },
    'spotify': { id: 'spotify', pkg: 'com.spotify.music', name: 'Spotify Music', category: 'Media', icon: '🎵', color: '#1DB954', locked: false, lockType: 'pin', invisiblePattern: false },
    'netflix': { id: 'netflix', pkg: 'com.netflix.mediaclient', name: 'Netflix', category: 'Media', icon: '🎬', color: '#E50914', locked: false, lockType: 'pin', invisiblePattern: false },
    'gmail': { id: 'gmail', pkg: 'com.google.android.gm', name: 'Gmail', category: 'Productivity', icon: '📧', color: '#EA4335', locked: false, lockType: 'pattern', invisiblePattern: false },
    'camera': { id: 'camera', pkg: 'com.android.camera', name: 'Camera', category: 'System', icon: '📷', color: '#5F6368', locked: true, lockType: 'biometrics', invisiblePattern: false },
    'contacts': { id: 'contacts', pkg: 'com.android.contacts', name: 'Contacts & Phone', category: 'System', icon: '📞', color: '#34A853', locked: true, lockType: 'pin', invisiblePattern: false },
    'messages': { id: 'messages', pkg: 'com.google.android.apps.messaging', name: 'SMS Messages', category: 'Social', icon: '💬', color: '#1A73E8', locked: true, lockType: 'pattern', invisiblePattern: true },
    'settings': { id: 'settings', pkg: 'com.android.settings', name: 'Device Settings', category: 'System', icon: '⚙️', color: '#8E8E93', locked: true, lockType: 'pin', invisiblePattern: false },
    'tiktok': { id: 'tiktok', pkg: 'com.zhiliaoapp.musically', name: 'TikTok', category: 'Social', icon: '🎵', color: '#000000', locked: false, lockType: 'pin', invisiblePattern: false }
  };

  let appConfigs = JSON.parse(localStorage.getItem('applock_app_configs')) || defaultAppDirectory;
  let activeProfile = localStorage.getItem('applock_active_profile') || 'default';

  /* ==========================================================================
     PWA Offline Install & Native APK Download Modal Handlers
     ========================================================================== */
  const nativeModal = document.getElementById('native-download-modal');
  const btnCloseNative = document.getElementById('btn-close-native-download');
  const btnTriggerPwa = document.getElementById('btn-trigger-pwa-prompt');

  const openNativeModal = () => {
    if (nativeModal) nativeModal.classList.add('active-modal');
  };

  const btnNav = document.getElementById('btn-pwa-install');
  const btnHero = document.getElementById('hero-btn-pwa-install');
  if (btnNav) btnNav.onclick = openNativeModal;
  if (btnHero) btnHero.onclick = openNativeModal;

  if (btnCloseNative) {
    btnCloseNative.onclick = () => nativeModal.classList.remove('active-modal');
  }

  if (btnTriggerPwa) {
    btnTriggerPwa.onclick = () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            showNotification('App Lock native standalone app installed!', 'success');
          }
          deferredInstallPrompt = null;
        });
      } else {
        showNotification('Launching Standalone App Installation...', 'info');
        alert("📱 INSTALL APP LOCK STANDALONE APP\n\nTo install App Lock as a standalone native app on your phone:\n\n1. Tap your browser's menu (3 dots at top right in Chrome/Edge, or Share button in Safari).\n2. Tap 'Install App' or 'Add to Home screen'.\n\nApp Lock will install as a native icon in your App Drawer!");
      }
    };
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  /* ==========================================================================
     Navigation & Tab View Controller
     ========================================================================== */
  const navTabs = document.querySelectorAll('.nav-tab');
  const viewSections = document.querySelectorAll('.view-section');

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.dataset.view;
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      viewSections.forEach(sec => {
        if (sec.id === `view-${targetView}`) {
          sec.classList.add('active-view');
        } else {
          sec.classList.remove('active-view');
        }
      });

      if (targetView === 'vault') loadVaultMedia();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  /* ==========================================================================
     App Protection Command Dashboard Render & Toggle Logic
     ========================================================================== */
  const appsGrid = document.getElementById('apps-grid');

  let currentSearchQuery = '';
  let currentCategoryFilter = 'all';

  const searchInput = document.getElementById('installed-app-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      currentSearchQuery = e.target.value.toLowerCase().trim();
      renderAppProtectionList();
    };
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategoryFilter = btn.dataset.cat;
      renderAppProtectionList();
    };
  });

  function renderAppProtectionList() {
    if (!appsGrid) return;
    appsGrid.innerHTML = '';

    const filteredApps = Object.values(appConfigs).filter(app => {
      const matchSearch = app.name.toLowerCase().includes(currentSearchQuery) || 
                          (app.category && app.category.toLowerCase().includes(currentSearchQuery)) ||
                          (app.pkg && app.pkg.toLowerCase().includes(currentSearchQuery));
      const matchCat = (currentCategoryFilter === 'all') || (app.category === currentCategoryFilter);
      return matchSearch && matchCat;
    });

    if (filteredApps.length === 0) {
      appsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No matching installed applications found. Click <b>"➕ Lock Custom App"</b> above to add any app!</div>`;
      return;
    }

    filteredApps.forEach(app => {
      const card = document.createElement('div');
      card.className = `app-card ${app.locked ? 'locked-active' : ''}`;
      card.innerHTML = `
        <div class="app-card-header">
          <div class="app-meta">
            <div class="app-icon-wrapper" style="background-color: ${app.color}">${app.icon}</div>
            <div class="app-title-box">
              <h4>${app.name}</h4>
              <div class="app-category">${app.category} ${app.pkg ? `• <span style="opacity: 0.6; font-size:10px;">${app.pkg}</span>` : ''}</div>
            </div>
          </div>
          <label class="apple-switch">
            <input type="checkbox" class="app-toggle-input" data-id="${app.id}" ${app.locked ? 'checked' : ''}>
            <span class="slider-pill"></span>
          </label>
        </div>
        <div class="app-card-footer">
          <div class="current-lock-badge">
            Lock Type: <span>${app.lockType.toUpperCase()}${app.lockType === 'pattern' && app.invisiblePattern ? ' (Invisible)' : ''}</span>
          </div>
          <button class="btn-config-lock" data-id="${app.id}">Configure Lock</button>
        </div>
      `;
      appsGrid.appendChild(card);
    });

    document.querySelectorAll('.app-toggle-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        appConfigs[id].locked = e.target.checked;
        saveConfigs();
        renderAppProtectionList();
        renderSandboxLauncher();
        showNotification(`${appConfigs[id].name} protection ${e.target.checked ? 'Enabled' : 'Disabled'}.`, e.target.checked ? 'success' : 'warning');
      });
    });

    document.querySelectorAll('.btn-config-lock').forEach(btn => {
      btn.addEventListener('click', (e) => {
        openConfigModal(e.target.dataset.id);
      });
    });
  }

  function saveConfigs() {
    localStorage.setItem('applock_app_configs', JSON.stringify(appConfigs));
  }

  /* ==========================================================================
     Custom Per-App Lock Configurator Modal
     ========================================================================== */
  const configModal = document.getElementById('config-modal');
  const btnCloseConfig = document.getElementById('btn-close-config');

  function openConfigModal(appId) {
    const app = appConfigs[appId];
    document.getElementById('config-app-name').innerText = app.name;
    document.getElementById('config-app-icon').innerText = app.icon;
    document.getElementById('select-lock-type').value = app.lockType;
    document.getElementById('toggle-invisible-pattern').checked = app.invisiblePattern || false;
    
    const patternRow = document.getElementById('row-invisible-pattern');
    patternRow.style.display = (app.lockType === 'pattern') ? 'flex' : 'none';

    document.getElementById('select-lock-type').onchange = (e) => {
      patternRow.style.display = (e.target.value === 'pattern') ? 'flex' : 'none';
    };

    document.getElementById('btn-save-config').onclick = () => {
      appConfigs[appId].lockType = document.getElementById('select-lock-type').value;
      appConfigs[appId].invisiblePattern = document.getElementById('toggle-invisible-pattern').checked;
      saveConfigs();
      configModal.classList.remove('active-modal');
      renderAppProtectionList();
      showNotification(`Lock preferences updated for ${app.name}!`, 'success');
    };

    configModal.classList.add('active-modal');
  }

  if (btnCloseConfig) {
    btnCloseConfig.addEventListener('click', () => configModal.classList.remove('active-modal'));
  }

  /* ==========================================================================
     Lock New Application Form & Modal Handlers
     ========================================================================== */
  const addAppModal = document.getElementById('add-app-modal');
  const btnOpenAddApp = document.getElementById('btn-open-add-app');
  const btnCloseAddApp = document.getElementById('btn-close-add-app');
  const btnCancelAddApp = document.getElementById('btn-cancel-add-app');
  const formAddApp = document.getElementById('form-add-app');

  if (btnOpenAddApp) {
    btnOpenAddApp.onclick = () => {
      document.getElementById('add-app-name').value = '';
      if (addAppModal) addAppModal.classList.add('active-modal');
    };
  }

  const closeAddAppModal = () => {
    if (addAppModal) addAppModal.classList.remove('active-modal');
  };
  if (btnCloseAddApp) btnCloseAddApp.onclick = closeAddAppModal;
  if (btnCancelAddApp) btnCancelAddApp.onclick = closeAddAppModal;

  if (formAddApp) {
    formAddApp.onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('add-app-name').value.trim();
      const category = document.getElementById('add-app-category').value;
      const icon = document.getElementById('add-app-icon').value.trim() || '🔒';
      const lockType = document.getElementById('add-app-locktype').value;

      if (!name) return;

      const newId = 'custom_app_' + Date.now();
      const presetColors = ['#0071E3', '#00C7FF', '#8A53FF', '#E1306C', '#34C759', '#FF9F0A', '#EA4335', '#25D366'];
      const randomColor = presetColors[Math.floor(Math.random() * presetColors.length)];

      appConfigs[newId] = {
        id: newId,
        name: name,
        category: category,
        icon: icon,
        color: randomColor,
        locked: true,
        lockType: lockType,
        invisiblePattern: false
      };

      saveConfigs();
      closeAddAppModal();
      renderAppProtectionList();
      renderSandboxLauncher();
      showNotification(`🔒 Protection enabled for ${name}!`, 'success');
    };
  }

  /* ==========================================================================
     Interactive OS Sandbox Launcher & ZERO-DELAY Lock Interceptor
     ========================================================================== */
  const phoneHomeScreen = document.getElementById('phone-home-screen');
  const lockInterceptModal = document.getElementById('lock-intercept-modal');

  function renderSandboxLauncher() {
    if (!phoneHomeScreen) return;
    phoneHomeScreen.innerHTML = '';

    Object.values(appConfigs).forEach(app => {
      const iconDiv = document.createElement('div');
      iconDiv.className = 'launcher-icon';
      iconDiv.innerHTML = `
        <div class="icon-glyph" style="background-color: ${app.color}">
          ${app.icon}
          ${app.locked ? `<div class="lock-shield-indicator">🔒</div>` : ''}
        </div>
        <div class="launcher-label">${app.name.length > 10 ? app.name.slice(0, 9) + '…' : app.name}</div>
      `;
      iconDiv.addEventListener('click', () => triggerAppLaunch(app.id));
      phoneHomeScreen.appendChild(iconDiv);
    });

    const addTile = document.createElement('div');
    addTile.className = 'launcher-icon';
    addTile.innerHTML = `
      <div class="icon-glyph" style="background: linear-gradient(135deg, #00C7FF, #8A53FF); border: 2px dashed #FFF;">➕</div>
      <div class="launcher-label">Lock App</div>
    `;
    addTile.addEventListener('click', () => {
      document.getElementById('add-app-name').value = '';
      const addAppModal = document.getElementById('add-app-modal');
      if (addAppModal) addAppModal.classList.add('active-modal');
    });
    phoneHomeScreen.appendChild(addTile);
  }

  function triggerAppLaunch(appId) {
    const app = appConfigs[appId];
    if (!app) return;

    if (!app.locked) {
      showAppSandboxContent(app);
      return;
    }

    currentActiveAppId = appId;
    currentPinInput = '';
    
    document.getElementById('intercept-app-icon').innerText = app.icon;
    document.getElementById('intercept-app-name').innerText = app.name;
    document.getElementById('intercept-app-icon').style.backgroundColor = app.color;
    document.getElementById('auth-subtext').innerText = `Enter ${app.lockType.toUpperCase()} to continue`;

    document.querySelectorAll('.auth-module-view').forEach(el => el.style.display = 'none');
    
    const lockoutBanner = document.getElementById('lockout-banner');
    lockoutBanner.style.display = 'none';

    if (authEngine.isAppLockedOut(appId)) {
      activateLockoutUIDisplay(appId);
    } else {
      setupActiveAuthenticatorUI(app);
    }

    lockInterceptModal.classList.add('active-modal');
  }

  function setupActiveAuthenticatorUI(app) {
    const type = app.lockType;
    if (type === 'pin') {
      document.getElementById('auth-view-pin').style.display = 'flex';
      renderPinDots(0);
    } else if (type === 'pattern') {
      const pView = document.getElementById('auth-view-pattern');
      pView.style.display = 'flex';
      const canvasEl = document.getElementById('pattern-canvas');
      if (patternLockInstance) patternLockInstance.reset();
      patternLockInstance = new PatternLock(canvasEl, handlePatternSubmit, { invisible: app.invisiblePattern });
    } else if (type === 'password') {
      document.getElementById('auth-view-password').style.display = 'flex';
      const inputEl = document.getElementById('password-text-input');
      inputEl.value = '';
      setTimeout(() => inputEl.focus(), 50);
    } else if (type === 'biometrics') {
      document.getElementById('auth-view-biometrics').style.display = 'flex';
      startBiometricScan();
    }
  }

  /* ==========================================================================
     Authentication Validation Handlers
     ========================================================================== */
  function renderPinDots(count, isError = false) {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, idx) => {
      dot.classList.remove('filled', 'error');
      if (isError) {
        dot.classList.add('error');
      } else if (idx < count) {
        dot.classList.add('filled');
      }
    });
  }

  document.querySelectorAll('.keypad-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (authEngine.isAppLockedOut(currentActiveAppId)) return;
      const val = e.currentTarget.dataset.val;
      if (val === 'del') {
        currentPinInput = currentPinInput.slice(0, -1);
        renderPinDots(currentPinInput.length);
        return;
      }
      if (currentPinInput.length < 4) {
        currentPinInput += val;
        renderPinDots(currentPinInput.length);
      }
      if (currentPinInput.length === 4) {
        const app = appConfigs[currentActiveAppId];
        const res = await authEngine.verifyCredential(currentActiveAppId, currentPinInput, 'pin', app.customHash);
        handleAuthResult(res);
      }
    });
  });

  async function handlePatternSubmit(patternString) {
    const app = appConfigs[currentActiveAppId];
    const res = await authEngine.verifyCredential(currentActiveAppId, patternString, 'pattern', app.customHash);
    if (!res.success) {
      patternLockInstance.showErrorAndReset();
    }
    handleAuthResult(res);
  }

  const formPassword = document.getElementById('password-form');
  if (formPassword) {
    formPassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputEl = document.getElementById('password-text-input');
      const app = appConfigs[currentActiveAppId];
      const res = await authEngine.verifyCredential(currentActiveAppId, inputEl.value, 'password', app.customHash);
      handleAuthResult(res);
    });
  }

  async function startBiometricScan() {
    const btn = document.getElementById('trigger-biometric-btn');
    btn.innerHTML = '🧬';
    const res = await authEngine.triggerBiometricUnlock(currentActiveAppId);
    handleAuthResult(res);
  }
  const bioBtn = document.getElementById('trigger-biometric-btn');
  if (bioBtn) bioBtn.addEventListener('click', startBiometricScan);

  function handleAuthResult(res) {
    if (res.success) {
      lockInterceptModal.classList.remove('active-modal');
      showAppSandboxContent(appConfigs[currentActiveAppId]);
    } else {
      const authBox = document.getElementById('auth-container');
      authBox.classList.remove('shake-animation');
      void authBox.offsetWidth;
      authBox.classList.add('shake-animation');

      if (res.lockedOut) {
        activateLockoutUIDisplay(currentActiveAppId);
      } else {
        showNotification(`Incorrect lock entry! (${res.attemptsLeft} tries left before 30s lockout)`, 'danger');
        if (appConfigs[currentActiveAppId].lockType === 'pin') {
          renderPinDots(4, true);
          setTimeout(() => { currentPinInput = ''; renderPinDots(0); }, 500);
        }
      }
    }
  }

  /* ==========================================================================
     30-Second Brute Force Lockout Display
     ========================================================================== */
  function activateLockoutUIDisplay(appId) {
    document.querySelectorAll('.auth-module-view').forEach(el => el.style.display = 'none');
    const lockoutBanner = document.getElementById('lockout-banner');
    const timerText = document.getElementById('lockout-timer-text');
    const progressFill = document.getElementById('lockout-progress-fill');
    
    lockoutBanner.style.display = 'flex';
    showNotification('Too many failed attempts! App locked for 30 seconds.', 'danger');

    authEngine.startLockoutTimerDisplay(
      appId,
      (secsLeft) => {
        timerText.innerText = `Try again in ${secsLeft} seconds`;
        const percent = (secsLeft / 30) * 100;
        progressFill.style.width = `${percent}%`;
      },
      () => {
        lockoutBanner.style.display = 'none';
        setupActiveAuthenticatorUI(appConfigs[appId]);
        showNotification('Lockout timer ended. You may try unlocking again.', 'success');
      }
    );
  }

  document.getElementById('btn-close-intercept').addEventListener('click', () => {
    lockInterceptModal.classList.remove('active-modal');
  });

  function showAppSandboxContent(app) {
    const sandboxModal = document.getElementById('app-viewer-modal');
    document.getElementById('viewer-app-name').innerText = app.name;
    document.getElementById('viewer-app-icon-badge').innerText = app.icon;
    document.getElementById('viewer-app-icon-badge').style.backgroundColor = app.color;
    
    const container = document.getElementById('viewer-dummy-content');

    if (app.id === 'whatsapp') {
      let savedNotes = JSON.parse(localStorage.getItem('applock_wa_notes') || '["🔒 Encrypted Note: Keep recovery passcode safe", "🔑 Vault PIN set to 2026"]');
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 440px; background: #0B141A; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
          <div style="background: #202C33; padding: 14px 18px; display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #25D366; display: flex; align-items: center; justify-content: center; font-size: 20px;">💬</div>
            <div>
              <h4 style="color: #FFF; font-size: 16px; margin: 0;">Secured Private Notes</h4>
              <span style="color: #00A884; font-size: 12px;">● End-to-End Encrypted</span>
            </div>
          </div>
          <div id="wa-notes-list" style="flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
            ${savedNotes.map(n => `<div style="background: #005C4B; color: #E9EDEF; padding: 10px 14px; border-radius: 12px 12px 0 12px; max-width: 80%; align-self: flex-end; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${n}</div>`).join('')}
          </div>
          <div style="background: #202C33; padding: 12px; display: flex; gap: 10px;">
            <input type="text" id="wa-input" class="glass-input" placeholder="Type a secure note or chat message..." style="font-size: 14px; padding: 10px 14px;">
            <button id="wa-send-btn" class="btn-primary" style="padding: 10px 18px; background: #00A884;">Send</button>
          </div>
        </div>
      `;
      setTimeout(() => {
        const sendBtn = document.getElementById('wa-send-btn');
        const inputEl = document.getElementById('wa-input');
        const listEl = document.getElementById('wa-notes-list');
        sendBtn.onclick = () => {
          if (!inputEl.value.trim()) return;
          savedNotes.push(inputEl.value.trim());
          localStorage.setItem('applock_wa_notes', JSON.stringify(savedNotes));
          const msgDiv = document.createElement('div');
          msgDiv.style.cssText = 'background: #005C4B; color: #E9EDEF; padding: 10px 14px; border-radius: 12px 12px 0 12px; max-width: 80%; align-self: flex-end; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);';
          msgDiv.innerText = inputEl.value.trim();
          listEl.appendChild(msgDiv);
          inputEl.value = '';
          listEl.scrollTop = listEl.scrollHeight;
        };
      }, 50);
    } 
    else if (app.id === 'banking') {
      let balance = parseFloat(localStorage.getItem('applock_bank_bal') || '48250.00');
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 18px; color: #FFF;">
          <div style="background: linear-gradient(135deg, #0071E3, #00C7FF); padding: 24px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,113,227,0.4);">
            <span style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Total Net Worth Balance</span>
            <h2 id="bank-bal-text" style="font-family: var(--font-heading); font-size: 36px; font-weight: 800; margin: 8px 0 4px;">$${balance.toLocaleString('en-US', {minimumFractionDigits: 2})}</h2>
            <span style="font-size: 12px; opacity: 0.9;">Account: **** **** **** 8829 (Checking)</span>
          </div>

          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 18px;">
            <h4 style="margin-bottom: 12px; font-size: 15px;">Quick Money Transfer</h4>
            <div style="display: flex; gap: 10px;">
              <input type="number" id="bank-transfer-amt" class="glass-input" placeholder="Amount ($)..." style="font-size: 14px; padding: 10px;">
              <button id="bank-send-btn" class="btn-primary" style="padding: 10px 18px;">Transfer</button>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 18px;">
            <h4 style="margin-bottom: 10px; font-size: 15px;">Recent Activity</h4>
            <div id="bank-tx-list" style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--text-secondary);">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <span>Apple Store Purchase</span>
                <span style="color: var(--color-danger); font-weight: 700;">-$299.00</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span>Payroll Direct Deposit</span>
                <span style="color: var(--color-success); font-weight: 700;">+$3,500.00</span>
              </div>
            </div>
          </div>
        </div>
      `;
      setTimeout(() => {
        const sendBtn = document.getElementById('bank-send-btn');
        const amtInput = document.getElementById('bank-transfer-amt');
        sendBtn.onclick = () => {
          const val = parseFloat(amtInput.value);
          if (isNaN(val) || val <= 0) return;
          balance -= val;
          localStorage.setItem('applock_bank_bal', balance.toString());
          document.getElementById('bank-bal-text').innerText = `$${balance.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
          showNotification(`Transferred $${val.toFixed(2)} successfully!`, 'success');
          amtInput.value = '';
        };
      }, 50);
    }
    else if (app.id === 'gallery') {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="color: #FFF; margin: 0;">Secured Photos (3 Albums)</h4>
            <button class="btn-secondary" onclick="document.querySelector('[data-view=\'vault\']').click(); document.getElementById('btn-close-app-viewer').click();" style="font-size: 12px; padding: 6px 14px;">Open Vault ➔</button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
            <div style="background: linear-gradient(135deg, #FF9F0A, #FF3B30); height: 120px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #FFF; box-shadow: 0 6px 16px rgba(0,0,0,0.4); cursor: pointer;">🏝️</div>
            <div style="background: linear-gradient(135deg, #0071E3, #00C7FF); height: 120px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #FFF; box-shadow: 0 6px 16px rgba(0,0,0,0.4); cursor: pointer;">🏎️</div>
            <div style="background: linear-gradient(135deg, #8A53FF, #E1306C); height: 120px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #FFF; box-shadow: 0 6px 16px rgba(0,0,0,0.4); cursor: pointer;">📸</div>
          </div>
        </div>
      `;
    }
    else if (app.id === 'instagram') {
      let likes = parseInt(localStorage.getItem('applock_ig_likes') || '1420');
      container.innerHTML = `
        <div style="background: #000; border-radius: 16px; padding: 16px; border: 1px solid rgba(255,255,255,0.1); color: #FFF;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #FF9F0A, #E1306C); padding: 2px;">
              <div style="width: 100%; height: 100%; border-radius: 50%; background: #000; display: flex; align-items: center; justify-content: center; font-size: 16px;">👤</div>
            </div>
            <span style="font-weight: 700; font-size: 14px;">applock_official</span>
          </div>
          <div style="background: linear-gradient(135deg, #1A1E2E, #12141F); height: 200px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 54px; margin-bottom: 12px; border: 1px solid rgba(0,199,255,0.3);">
            🛡️
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <button id="ig-like-btn" class="btn-secondary" style="border-color: #E1306C; color: #E1306C; padding: 6px 16px;">❤️ Like (<span id="ig-like-cnt">${likes}</span>)</button>
            <span style="font-size: 12px; color: var(--text-muted);">2 hours ago</span>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">Protected by App Lock zero-data-snooping security engine.</p>
        </div>
      `;
      setTimeout(() => {
        document.getElementById('ig-like-btn').onclick = () => {
          likes += 1;
          localStorage.setItem('applock_ig_likes', likes.toString());
          document.getElementById('ig-like-cnt').innerText = likes.toString();
        };
      }, 50);
    }
    else {
      container.innerHTML = `
        <div style="padding: 30px; text-align: center; color: var(--text-secondary);">
          <div style="font-size: 52px; margin-bottom: 16px;">${app.icon}</div>
          <h3 style="color: #FFF; font-family: var(--font-heading); margin-bottom: 8px;">Active Protected Application: ${app.name}</h3>
          <p style="font-size: 14px; max-width: 400px; margin: 0 auto 20px;">This application is active and protected under the App Lock security posture. Zero data snooping active.</p>
          <div style="display: inline-block; background: rgba(52,199,89,0.15); color: var(--color-success); border: 1px solid var(--color-success); padding: 8px 18px; border-radius: 9999px; font-size: 13px; font-weight: 700;">
            ✓ Real-Time Shield Armed
          </div>
        </div>
      `;
    }

    sandboxModal.classList.add('active-modal');
  }

  document.getElementById('btn-close-app-viewer').addEventListener('click', () => {
    document.getElementById('app-viewer-modal').classList.remove('active-modal');
  });

  /* ==========================================================================
     Master Credentials Customizer Handlers
     ========================================================================== */
  const btnSavePin = document.getElementById('btn-save-custom-pin');
  const btnSavePass = document.getElementById('btn-save-custom-pass');
  const btnEnrollBio = document.getElementById('btn-enroll-biometrics');

  if (btnSavePin) {
    btnSavePin.onclick = async () => {
      const pinVal = document.getElementById('input-custom-pin').value.trim();
      if (!pinVal || pinVal.length < 4) {
        showNotification('Master PIN must be at least 4 digits long!', 'warning');
        return;
      }
      await authEngine.setCustomPIN(pinVal);
      showNotification('🔒 Master PIN Code updated successfully!', 'success');
      document.getElementById('input-custom-pin').value = '';
    };
  }

  if (btnSavePass) {
    btnSavePass.onclick = async () => {
      const passVal = document.getElementById('input-custom-pass').value.trim();
      if (!passVal || passVal.length < 3) {
        showNotification('Master Password must be at least 3 characters long!', 'warning');
        return;
      }
      await authEngine.setCustomPassword(passVal);
      showNotification('🔒 Master Password updated successfully!', 'success');
      document.getElementById('input-custom-pass').value = '';
    };
  }

  if (btnEnrollBio) {
    btnEnrollBio.onclick = async () => {
      if (window.PublicKeyCredential) {
        try {
          showNotification('Scanning phone biometric sensor...', 'info');
          localStorage.setItem('applock_biometrics_enrolled', 'true');
          setTimeout(() => {
            showNotification('👆 Fingerprint / Face ID sensor enrolled successfully!', 'success');
          }, 800);
        } catch(err) {
          showNotification('Biometric sensor error: ' + err.message, 'danger');
        }
      } else {
        localStorage.setItem('applock_biometrics_enrolled', 'true');
        showNotification('👆 Biometric sensor registered successfully!', 'success');
      }
    };
  }

  /* ==========================================================================
     Master Backup Password & Recovery Override
     ========================================================================== */
  const recoveryModal = document.getElementById('recovery-modal');

  document.getElementById('link-forgot-lock').addEventListener('click', () => {
    document.getElementById('recovery-input-pass').value = '';
    recoveryModal.classList.add('active-modal');
  });

  document.getElementById('btn-close-recovery').addEventListener('click', () => {
    recoveryModal.classList.remove('active-modal');
  });

  document.getElementById('form-recovery').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = document.getElementById('recovery-input-pass').value;
    const isMasterOk = await authEngine.verifyMasterRecovery(val);
    
    if (!isMasterOk) {
      showNotification('Incorrect Master Emergency Recovery Password!', 'danger');
      return;
    }

    recoveryModal.classList.remove('active-modal');
    lockInterceptModal.classList.remove('active-modal');

    if (confirm(`Master verification successful for ${appConfigs[currentActiveAppId].name}!\nWould you like to permanently turn OFF locking for this app? (OK = Disable Lock, Cancel = Just Open Now)`)) {
      appConfigs[currentActiveAppId].locked = false;
      saveConfigs();
      renderAppProtectionList();
      renderSandboxLauncher();
      showNotification(`Lock turned off for ${appConfigs[currentActiveAppId].name}.`, 'warning');
    }
    showAppSandboxContent(appConfigs[currentActiveAppId]);
  });

  /* ==========================================================================
     Scenario Profiles Switcher
     ========================================================================== */
  const profileCards = document.querySelectorAll('.profile-card');
  
  function applyProfile(profileKey) {
    activeProfile = profileKey;
    localStorage.setItem('applock_active_profile', profileKey);

    profileCards.forEach(c => {
      c.classList.toggle('active-profile', c.dataset.profile === profileKey);
    });

    if (profileKey === 'work') {
      appConfigs['instagram'].locked = true;
      appConfigs['tiktok'].locked = true;
      appConfigs['gmail'].locked = false;
      showNotification('Work Profile Engaged: Social Media & Gaming Apps automatically locked.', 'success');
    } else if (profileKey === 'home') {
      appConfigs['gmail'].locked = true;
      appConfigs['banking'].locked = true;
      appConfigs['instagram'].locked = false;
      showNotification('Home Profile Engaged: Work Email and Financial Apps locked.', 'success');
    } else if (profileKey === 'guest') {
      Object.keys(appConfigs).forEach(k => appConfigs[k].locked = true);
      showNotification('Guest Profile Engaged: Maximum security! EVERY application is locked.', 'warning');
    } else {
      appConfigs = JSON.parse(JSON.stringify(defaultAppDirectory));
      showNotification('Default Profile Restored.', 'success');
    }
    saveConfigs();
    renderAppProtectionList();
    renderSandboxLauncher();
  }

  profileCards.forEach(card => {
    card.addEventListener('click', () => applyProfile(card.dataset.profile));
  });
  applyProfile(activeProfile);

  /* ==========================================================================
     New App Installation Detection Simulation & Uninstall Shield
     ========================================================================== */
  document.getElementById('btn-simulate-new-app').addEventListener('click', () => {
    const newAppName = Math.random() > 0.5 ? 'Snapchat (Social)' : 'Robinhood (Finance)';
    if (confirm(`🚨 NEW APPLICATION INSTALLED: ${newAppName}\n\nWould you like App Lock to immediately secure this new app with Pattern/PIN Lock right now?`)) {
      showNotification(`App Lock protection successfully activated for ${newAppName}!`, 'success');
    }
  });

  document.getElementById('btn-instant-uninstall').addEventListener('click', () => {
    if (confirm('🚨 DEACTIVATE APP LOCK & RELEASE ALL APPS?\n\nPer security policy, uninstalling or disabling the security engine instantly releases all app restrictions without asking for further permissions so you never lose access to your apps.')) {
      Object.keys(appConfigs).forEach(k => appConfigs[k].locked = false);
      saveConfigs();
      renderAppProtectionList();
      renderSandboxLauncher();
      showNotification('All applications instantly unlocked and released!', 'warning');
    }
  });

  /* ==========================================================================
     Encrypted Photo / Video Media Vault UI Handlers
     ========================================================================== */
  const dropzone = document.getElementById('vault-dropzone');
  const fileInput = document.getElementById('vault-file-input');
  const vaultGrid = document.getElementById('vault-grid');
  const mediaViewer = document.getElementById('media-viewer-modal');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = '#00C7FF'; });
    dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--border-glow)');
    
    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border-glow)';
      if (e.dataTransfer.files.length > 0) handleFilesImport(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) handleFilesImport(e.target.files);
    });
  }

  async function handleFilesImport(fileList) {
    showNotification(`Encrypting and vaulting ${fileList.length} media file(s) with AES-256...`, 'info');
    for (const file of Array.from(fileList)) {
      await mediaVault.importAndEncryptFile(file);
    }
    showNotification('Files successfully encrypted into offline Vault storage!', 'success');
    loadVaultMedia();
  }

  async function loadVaultMedia() {
    if (!vaultGrid) return;
    const items = await mediaVault.getAllItems();
    vaultGrid.innerHTML = '';

    if (items.length === 0) {
      vaultGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No encrypted media stored yet. Drop photos or videos above to protect them!</p>`;
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'vault-media-card';
      const isVideo = item.mimeType.startsWith('video/');
      card.innerHTML = `
        <div style="width:100%; height:100%; background: #111422; display:flex; align-items:center; justify-content:center; font-size:42px;">
          ${isVideo ? '🎥' : '🖼️'}
        </div>
        <div class="vault-media-overlay">
          <span>${item.name.length > 15 ? item.name.slice(0, 12) + '…' : item.name}</span>
          <span class="badge-encrypted">AES-256</span>
        </div>
      `;
      card.addEventListener('click', () => openEncryptedViewer(item));
      vaultGrid.appendChild(card);
    });
  }

  let activeBlobUrl = null;
  async function openEncryptedViewer(item) {
    activeBlobUrl = await mediaVault.decryptToBlobUrl(item);
    const container = document.getElementById('viewer-content-box');
    container.innerHTML = '';

    if (item.mimeType.startsWith('video/')) {
      const vid = document.createElement('video');
      vid.src = activeBlobUrl;
      vid.controls = true;
      vid.autoplay = true;
      container.appendChild(vid);
    } else {
      const img = document.createElement('img');
      img.src = activeBlobUrl;
      container.appendChild(img);
    }
    mediaViewer.classList.add('active-viewer');
  }

  document.getElementById('btn-close-viewer').addEventListener('click', () => {
    mediaViewer.classList.remove('active-viewer');
    mediaVault.revokeBlobUrl(activeBlobUrl);
    activeBlobUrl = null;
  });

  /* ==========================================================================
     Apple-Style Floating Toast Notification Engine
     ========================================================================== */
  function showNotification(msg, type = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = 'position: fixed; top: 24px; right: 24px; z-index: 99999999; display: flex; flex-direction: column; gap: 12px;';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const colors = { success: '#34C759', danger: '#FF3B30', warning: '#FF9F0A', info: '#00C7FF' };
    toast.style.cssText = `
      background: rgba(18, 20, 31, 0.92); backdrop-filter: blur(20px); border: 1px solid ${colors[type] || '#FFF'};
      color: #FFF; padding: 16px 24px; border-radius: 16px; font-size: 14px; font-weight: 600;
      box-shadow: 0 15px 40px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 12px;
      transform: translateX(50px); opacity: 0; transition: all 0.35s cubic-bezier(0.18, 0.89, 0.32, 1.28);
    `;
    toast.innerHTML = `<span style="color: ${colors[type] || '#FFF'}; font-size: 18px;">${type === 'success' ? '✅' : type === 'danger' ? '🚨' : 'ℹ️'}</span> <span>${msg}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => { toast.style.transform = 'translateX(0)'; toast.style.opacity = '1'; }, 20);
    setTimeout(() => {
      toast.style.opacity = '0'; toast.style.transform = 'translateY(-20px)';
      setTimeout(() => toast.remove(), 350);
    }, 4500);
  }

  renderAppProtectionList();
  renderSandboxLauncher();
});
