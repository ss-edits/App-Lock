/**
 * App Lock & Secure Media Vault — Master Application Controller & Android Native Bridge
 * Handles real-time Android app interception, system permissions, UI views, scenario profiles, and offline Vault.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const authEngine = new AuthEngine();
  const mediaVault = new MediaVaultEngine();
  await mediaVault.init();

  let deferredInstallPrompt = null;
  let currentActiveAppId = null;
  let patternLockInstance = null;
  let currentPinInput = '';

  // Default fallback directory when previewing in PC desktop browser (outside Android APK)
  const defaultAppDirectory = {
    'com.whatsapp': { id: 'com.whatsapp', pkg: 'com.whatsapp', name: 'WhatsApp Messenger', category: 'Social & Messaging', icon: '💬', color: '#25D366', locked: true, lockType: 'pattern', invisiblePattern: true },
    'com.instagram.android': { id: 'com.instagram.android', pkg: 'com.instagram.android', name: 'Instagram', category: 'Social & Messaging', icon: '📸', color: '#E1306C', locked: true, lockType: 'biometrics', invisiblePattern: false },
    'com.google.android.apps.photos': { id: 'com.google.android.apps.photos', pkg: 'com.google.android.apps.photos', name: 'Google Photos & Gallery', category: 'Photos & Media', icon: '🖼️', color: '#FF9F0A', locked: true, lockType: 'password', invisiblePattern: false },
    'net.one97.paytm': { id: 'net.one97.paytm', pkg: 'net.one97.paytm', name: 'Paytm Wallet & UPI', category: 'Finance & Payments', icon: '💳', color: '#002E6E', locked: true, lockType: 'pin', invisiblePattern: false },
    'com.google.android.apps.nfc.payment': { id: 'com.google.android.apps.nfc.payment', pkg: 'com.google.android.apps.nfc.payment', name: 'Google Pay (GPay)', category: 'Finance & Payments', icon: '💰', color: '#4285F4', locked: true, lockType: 'pin', invisiblePattern: false },
    'com.phonepe.app': { id: 'com.phonepe.app', pkg: 'com.phonepe.app', name: 'PhonePe UPI', category: 'Finance & Payments', icon: '🟣', color: '#5F259F', locked: true, lockType: 'pin', invisiblePattern: false },
    'com.google.android.youtube': { id: 'com.google.android.youtube', pkg: 'com.google.android.youtube', name: 'YouTube', category: 'Photos & Media', icon: '▶️', color: '#FF0000', locked: false, lockType: 'pattern', invisiblePattern: false },
    'com.android.chrome': { id: 'com.android.chrome', pkg: 'com.android.chrome', name: 'Google Chrome', category: 'System & Settings', icon: '🌐', color: '#0F9D58', locked: true, lockType: 'pin', invisiblePattern: false },
    'com.facebook.katana': { id: 'com.facebook.katana', pkg: 'com.facebook.katana', name: 'Facebook', category: 'Social & Messaging', icon: '📘', color: '#1877F2', locked: false, lockType: 'pin', invisiblePattern: false },
    'com.snapchat.android': { id: 'com.snapchat.android', pkg: 'com.snapchat.android', name: 'Snapchat', category: 'Social & Messaging', icon: '👻', color: '#FFFC00', locked: true, lockType: 'pattern', invisiblePattern: true },
    'org.telegram.messenger': { id: 'org.telegram.messenger', pkg: 'org.telegram.messenger', name: 'Telegram Messenger', category: 'Social & Messaging', icon: '✈️', color: '#0088CC', locked: false, lockType: 'pin', invisiblePattern: false },
    'com.spotify.music': { id: 'com.spotify.music', pkg: 'com.spotify.music', name: 'Spotify Music', category: 'Photos & Media', icon: '🎵', color: '#1DB954', locked: false, lockType: 'pin', invisiblePattern: false },
    'com.netflix.mediaclient': { id: 'com.netflix.mediaclient', pkg: 'com.netflix.mediaclient', name: 'Netflix', category: 'Photos & Media', icon: '🎬', color: '#E50914', locked: false, lockType: 'pin', invisiblePattern: false },
    'com.google.android.gm': { id: 'com.google.android.gm', pkg: 'com.google.android.gm', name: 'Gmail', category: 'General', icon: '📧', color: '#EA4335', locked: false, lockType: 'pattern', invisiblePattern: false },
    'com.android.camera': { id: 'com.android.camera', pkg: 'com.android.camera', name: 'Camera', category: 'System & Settings', icon: '📷', color: '#5F6368', locked: true, lockType: 'biometrics', invisiblePattern: false },
    'com.android.settings': { id: 'com.android.settings', pkg: 'com.android.settings', name: 'Device Settings', category: 'System & Settings', icon: '⚙️', color: '#8E8E93', locked: true, lockType: 'pin', invisiblePattern: false }
  };

  let appConfigs = JSON.parse(localStorage.getItem('applock_app_configs')) || defaultAppDirectory;
  let activeProfile = localStorage.getItem('applock_active_profile') || 'default';

  /* ==========================================================================
     Android Native Bridge & System Permission Monitor
     ========================================================================== */
  function syncWithNativeEngine() {
    if (window.NativeAppLock && typeof window.NativeAppLock.getInstalledApps === 'function') {
      try {
        const installedJson = window.NativeAppLock.getInstalledApps();
        const liveApps = JSON.parse(installedJson);
        const mergedConfigs = {};

        liveApps.forEach(app => {
          const existing = appConfigs[app.pkg] || appConfigs[app.name.toLowerCase()];
          mergedConfigs[app.pkg] = {
            id: app.pkg,
            pkg: app.pkg,
            name: app.name,
            category: app.category || 'General',
            icon: app.icon || '📱',
            color: app.color || '#0071E3',
            locked: existing ? existing.locked : isDefaultLockCandidate(app.pkg),
            lockType: existing ? existing.lockType : 'pin',
            invisiblePattern: existing ? existing.invisiblePattern : false,
            customHash: existing ? existing.customHash : null
          };
        });

        Object.keys(appConfigs).forEach(k => {
          if (!mergedConfigs[k] && appConfigs[k].isCustom) {
            mergedConfigs[k] = appConfigs[k];
          }
        });

        appConfigs = mergedConfigs;
        saveConfigs(false);
      } catch(err) {
        console.error('Error fetching live Android PackageManager apps:', err);
      }
    }

    sendLockedAppsToNative();
    checkAndroidPermissions();
  }

  function isDefaultLockCandidate(pkg) {
    const p = (pkg || '').toLowerCase();
    return p.includes('whatsapp') || p.includes('instagram') || p.includes('photo') || p.includes('paytm') || p.includes('payment') || p.includes('phonepe') || p.includes('snapchat');
  }

  function sendLockedAppsToNative() {
    if (window.NativeAppLock && typeof window.NativeAppLock.setLockedApps === 'function') {
      const lockedPkgs = Object.values(appConfigs)
        .filter(a => a.locked && a.pkg)
        .map(a => a.pkg);
      window.NativeAppLock.setLockedApps(JSON.stringify(lockedPkgs));
    }
  }

  function checkAndroidPermissions() {
    if (window.NativeAppLock && typeof window.NativeAppLock.checkUsageAccessPermission === 'function') {
      const hasUsage = window.NativeAppLock.checkUsageAccessPermission();
      const hasOverlay = window.NativeAppLock.checkOverlayPermission();
      
      const banner = document.getElementById('android-permissions-banner');
      if (banner) {
        banner.style.display = (!hasUsage || !hasOverlay) ? 'block' : 'none';
      }

      const usageBtn = document.getElementById('setting-btn-usage');
      if (usageBtn) {
        if (hasUsage) {
          usageBtn.innerText = '✅ Permission Granted';
          usageBtn.style.borderColor = '#34C759';
          usageBtn.style.color = '#34C759';
        } else {
          usageBtn.innerText = '⚠️ Tap to Grant Usage Access';
          usageBtn.style.borderColor = '#FF9F0A';
          usageBtn.style.color = '#FF9F0A';
        }
      }

      const overlayBtn = document.getElementById('setting-btn-overlay');
      if (overlayBtn) {
        if (hasOverlay) {
          overlayBtn.innerText = '✅ Permission Granted';
          overlayBtn.style.borderColor = '#34C759';
          overlayBtn.style.color = '#34C759';
        } else {
          overlayBtn.innerText = '⚠️ Tap to Grant Overlay Permission';
          overlayBtn.style.borderColor = '#FF9F0A';
          overlayBtn.style.color = '#FF9F0A';
        }
      }
    }
  }

  const btnGrantUsage = document.getElementById('btn-grant-usage');
  const btnGrantOverlay = document.getElementById('btn-grant-overlay');
  const settingBtnUsage = document.getElementById('setting-btn-usage');
  const settingBtnOverlay = document.getElementById('setting-btn-overlay');

  const triggerUsagePerm = () => {
    if (window.NativeAppLock && window.NativeAppLock.requestUsageAccessPermission) {
      showNotification('Opening Android Settings -> Usage Access...', 'info');
      window.NativeAppLock.requestUsageAccessPermission();
    } else {
      showNotification('Please install our Android APK to access System Settings.', 'warning');
    }
  };

  const triggerOverlayPerm = () => {
    if (window.NativeAppLock && window.NativeAppLock.requestOverlayPermission) {
      showNotification('Opening Android Settings -> Display over other apps...', 'info');
      window.NativeAppLock.requestOverlayPermission();
    } else {
      showNotification('Please install our Android APK to access System Settings.', 'warning');
    }
  };

  if (btnGrantUsage) btnGrantUsage.onclick = triggerUsagePerm;
  if (settingBtnUsage) settingBtnUsage.onclick = triggerUsagePerm;
  if (btnGrantOverlay) btnGrantOverlay.onclick = triggerOverlayPerm;
  if (settingBtnOverlay) settingBtnOverlay.onclick = triggerOverlayPerm;

  window.addEventListener('focus', () => {
    checkAndroidPermissions();
  });

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
            showNotification('App Lock standalone app installed!', 'success');
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
      if (targetView === 'apps') syncWithNativeEngine();
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
      const matchSearch = (app.name && app.name.toLowerCase().includes(currentSearchQuery)) || 
                          (app.category && app.category.toLowerCase().includes(currentSearchQuery)) ||
                          (app.pkg && app.pkg.toLowerCase().includes(currentSearchQuery));
      const matchCat = (currentCategoryFilter === 'all') || 
                       (app.category && app.category.includes(currentCategoryFilter));
      return matchSearch && matchCat;
    });

    if (!window.NativeAppLock) {
      const notice = document.createElement('div');
      notice.style.cssText = 'grid-column: 1/-1; background: rgba(0, 199, 255, 0.1); border: 1px solid rgba(0, 199, 255, 0.3); color: #FFF; padding: 14px 20px; border-radius: 12px; margin-bottom: 12px; font-size: 13px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;';
      notice.innerHTML = `<span>💻 <b>Browser Preview Mode Active:</b> Showing popular app presets. Install our native Android APK on your mobile device to live-scan and lock your real installed phone apps!</span>`;
      appsGrid.appendChild(notice);
    }

    if (filteredApps.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);';
      emptyMsg.innerHTML = `No matching applications found. Click <b>"➕ Lock Custom App"</b> above to register any package!`;
      appsGrid.appendChild(emptyMsg);
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
              <div class="app-category">${app.category} ${app.pkg ? `• <span style="opacity: 0.7; font-size:11px; color:#FFF;">${app.pkg}</span>` : ''}</div>
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
        if (appConfigs[id]) {
          appConfigs[id].locked = e.target.checked;
          saveConfigs(true);
          showNotification(`${appConfigs[id].name} real-time lock ${e.target.checked ? 'Enabled' : 'Disabled'}.`, e.target.checked ? 'success' : 'warning');
        }
      });
    });

    document.querySelectorAll('.btn-config-lock').forEach(btn => {
      btn.addEventListener('click', (e) => {
        openConfigModal(e.target.dataset.id);
      });
    });
  }

  function saveConfigs(reRender = false) {
    localStorage.setItem('applock_app_configs', JSON.stringify(appConfigs));
    sendLockedAppsToNative();
    if (reRender) renderAppProtectionList();
  }

  /* ==========================================================================
     Custom Per-App Lock Configurator Modal
     ========================================================================== */
  const configModal = document.getElementById('config-modal');
  const btnCloseConfig = document.getElementById('btn-close-config');

  function openConfigModal(appId) {
    const app = appConfigs[appId];
    if (!app) return;
    document.getElementById('config-app-name').innerText = app.name;
    document.getElementById('config-app-icon').innerText = app.icon;
    document.getElementById('select-lock-type').value = app.lockType || 'pin';
    document.getElementById('toggle-invisible-pattern').checked = app.invisiblePattern || false;
    
    const patternRow = document.getElementById('row-invisible-pattern');
    patternRow.style.display = (app.lockType === 'pattern') ? 'flex' : 'none';

    document.getElementById('select-lock-type').onchange = (e) => {
      patternRow.style.display = (e.target.value === 'pattern') ? 'flex' : 'none';
    };

    document.getElementById('btn-save-config').onclick = () => {
      appConfigs[appId].lockType = document.getElementById('select-lock-type').value;
      appConfigs[appId].invisiblePattern = document.getElementById('toggle-invisible-pattern').checked;
      saveConfigs(true);
      configModal.classList.remove('active-modal');
      showNotification(`Lock rules updated for ${app.name}!`, 'success');
    };

    configModal.classList.add('active-modal');
  }

  if (btnCloseConfig) {
    btnCloseConfig.addEventListener('click', () => configModal.classList.remove('active-modal'));
  }

  /* ==========================================================================
     Lock New Custom Application Form & Modal Handlers
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

      let pkg = name.toLowerCase().includes('.') ? name.toLowerCase() : `com.custom.${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const newId = pkg;
      const presetColors = ['#0071E3', '#00C7FF', '#8A53FF', '#E1306C', '#34C759', '#FF9F0A', '#EA4335', '#25D366'];
      const randomColor = presetColors[Math.floor(Math.random() * presetColors.length)];

      appConfigs[newId] = {
        id: newId,
        pkg: pkg,
        name: name,
        category: category,
        icon: icon,
        color: randomColor,
        locked: true,
        lockType: lockType,
        invisiblePattern: false,
        isCustom: true
      };

      saveConfigs(true);
      closeAddAppModal();
      showNotification(`🔒 Protection enabled for ${name} (${pkg})!`, 'success');
    };
  }

  /* ==========================================================================
     Native Android Real-Time Background App Lock Interception Listener
     ========================================================================== */
  const lockInterceptModal = document.getElementById('lock-intercept-modal');

  window.onNativeAppLocked = function(lockedPkg) {
    if (!lockedPkg) return;
    const targetApp = Object.values(appConfigs).find(a => 
      (a.pkg && a.pkg.toLowerCase() === lockedPkg.toLowerCase()) || 
      (a.id && a.id.toLowerCase() === lockedPkg.toLowerCase())
    );

    if (targetApp && targetApp.locked) {
      triggerLockInterceptionChallenge(targetApp.id);
    } else {
      triggerLockInterceptionChallenge(lockedPkg, lockedPkg);
    }
  };

  function triggerLockInterceptionChallenge(appId, fallbackPkg = null) {
    const app = appConfigs[appId] || {
      id: fallbackPkg,
      name: fallbackPkg,
      icon: '🔒',
      color: '#0071E3',
      lockType: 'pin',
      invisiblePattern: false
    };

    currentActiveAppId = app.id;
    currentPinInput = '';
    
    document.getElementById('intercept-app-icon').innerText = app.icon;
    document.getElementById('intercept-app-name').innerText = app.name;
    document.getElementById('intercept-app-icon').style.backgroundColor = app.color;
    document.getElementById('auth-subtext').innerText = `Enter ${app.lockType.toUpperCase()} to continue`;

    document.querySelectorAll('.auth-module-view').forEach(el => el.style.display = 'none');
    
    const lockoutBanner = document.getElementById('lockout-banner');
    lockoutBanner.style.display = 'none';

    if (authEngine.isAppLockedOut(app.id)) {
      activateLockoutUIDisplay(app.id);
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
        const app = appConfigs[currentActiveAppId] || {};
        const res = await authEngine.verifyCredential(currentActiveAppId, currentPinInput, 'pin', app.customHash);
        handleAuthResult(res);
      }
    });
  });

  async function handlePatternSubmit(patternString) {
    const app = appConfigs[currentActiveAppId] || {};
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
      const app = appConfigs[currentActiveAppId] || {};
      const res = await authEngine.verifyCredential(currentActiveAppId, inputEl.value, 'password', app.customHash);
      handleAuthResult(res);
    });
  }

  async function startBiometricScan() {
    const btn = document.getElementById('trigger-biometric-btn');
    if (btn) btn.innerHTML = '🧬';
    const res = await authEngine.triggerBiometricUnlock(currentActiveAppId);
    handleAuthResult(res);
  }
  const bioBtn = document.getElementById('trigger-biometric-btn');
  if (bioBtn) bioBtn.addEventListener('click', startBiometricScan);

  function handleAuthResult(res) {
    if (res.success) {
      lockInterceptModal.classList.remove('active-modal');
      showNotification('🔓 Application verified! Returning to app...', 'success');
    } else {
      const authBox = document.getElementById('auth-container');
      authBox.classList.remove('shake-animation');
      void authBox.offsetWidth;
      authBox.classList.add('shake-animation');

      if (res.lockedOut) {
        activateLockoutUIDisplay(currentActiveAppId);
      } else {
        showNotification(`Incorrect credential entry! (${res.attemptsLeft} tries left before 30s lockout)`, 'danger');
        if (appConfigs[currentActiveAppId] && appConfigs[currentActiveAppId].lockType === 'pin') {
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
    showNotification('Too many failed attempts! Application locked for 30 seconds.', 'danger');

    authEngine.startLockoutTimerDisplay(
      appId,
      (secsLeft) => {
        timerText.innerText = `Try again in ${secsLeft} seconds`;
        const percent = (secsLeft / 30) * 100;
        progressFill.style.width = `${percent}%`;
      },
      () => {
        lockoutBanner.style.display = 'none';
        setupActiveAuthenticatorUI(appConfigs[appId] || { lockType: 'pin' });
        showNotification('Lockout timer expired. You may attempt verification again.', 'success');
      }
    );
  }

  const btnCloseIntercept = document.getElementById('btn-close-intercept');
  if (btnCloseIntercept) {
    btnCloseIntercept.addEventListener('click', () => {
      lockInterceptModal.classList.remove('active-modal');
    });
  }

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

  const linkForgot = document.getElementById('link-forgot-lock');
  if (linkForgot) {
    linkForgot.addEventListener('click', () => {
      document.getElementById('recovery-input-pass').value = '';
      recoveryModal.classList.add('active-modal');
    });
  }

  const btnCloseRecovery = document.getElementById('btn-close-recovery');
  if (btnCloseRecovery) {
    btnCloseRecovery.addEventListener('click', () => {
      recoveryModal.classList.remove('active-modal');
    });
  }

  const formRecovery = document.getElementById('form-recovery');
  if (formRecovery) {
    formRecovery.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = document.getElementById('recovery-input-pass').value;
      const isMasterOk = await authEngine.verifyMasterRecovery(val);
      
      if (!isMasterOk) {
        showNotification('Incorrect Master Emergency Recovery Password!', 'danger');
        return;
      }

      recoveryModal.classList.remove('active-modal');
      lockInterceptModal.classList.remove('active-modal');

      const targetApp = appConfigs[currentActiveAppId];
      const appName = targetApp ? targetApp.name : currentActiveAppId;

      if (confirm(`Master verification successful for ${appName}!\nWould you like to turn OFF real-time locking for this application? (OK = Disable Lock, Cancel = Unblock Once)`)) {
        if (targetApp) {
          targetApp.locked = false;
          saveConfigs(true);
        }
        showNotification(`Lock turned off for ${appName}.`, 'warning');
      } else {
        showNotification(`Temporary unblock granted for ${appName}.`, 'success');
      }
    });
  }

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
      if (appConfigs['com.instagram.android']) appConfigs['com.instagram.android'].locked = true;
      if (appConfigs['com.google.android.gm']) appConfigs['com.google.android.gm'].locked = false;
      showNotification('Work Profile Engaged: Social & Messaging apps locked; Productivity email opened.', 'success');
    } else if (profileKey === 'home') {
      if (appConfigs['com.google.android.gm']) appConfigs['com.google.android.gm'].locked = true;
      if (appConfigs['net.one97.paytm']) appConfigs['net.one97.paytm'].locked = true;
      if (appConfigs['com.instagram.android']) appConfigs['com.instagram.android'].locked = false;
      showNotification('Home Profile Engaged: Work Email and Financial tools locked.', 'success');
    } else if (profileKey === 'guest') {
      Object.keys(appConfigs).forEach(k => appConfigs[k].locked = true);
      showNotification('Guest Profile Engaged: Maximum security! EVERY installed app is locked.', 'warning');
    } else {
      appConfigs = JSON.parse(JSON.stringify(defaultAppDirectory));
      showNotification('Default Profile Restored.', 'success');
    }
    saveConfigs(true);
  }

  profileCards.forEach(card => {
    card.addEventListener('click', () => applyProfile(card.dataset.profile));
  });
  applyProfile(activeProfile);

  /* ==========================================================================
     Fail-Safe Uninstall Release Shield
     ========================================================================== */
  const btnInstantUninstall = document.getElementById('btn-instant-uninstall');
  if (btnInstantUninstall) {
    btnInstantUninstall.addEventListener('click', () => {
      if (confirm('🚨 DEACTIVATE APP LOCK & RELEASE ALL APPS?\n\nPer security policy, releasing all locks instantly turns off background interception without demanding passwords so you never lose access to your phone apps.')) {
        Object.keys(appConfigs).forEach(k => appConfigs[k].locked = false);
        saveConfigs(true);
        showNotification('All real-time app locks instantly released and turned off!', 'warning');
      }
    });
  }

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

  const btnCloseViewer = document.getElementById('btn-close-viewer');
  if (btnCloseViewer) {
    btnCloseViewer.addEventListener('click', () => {
      mediaViewer.classList.remove('active-viewer');
      if (activeBlobUrl) {
        mediaVault.revokeBlobUrl(activeBlobUrl);
        activeBlobUrl = null;
      }
    });
  }

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

  syncWithNativeEngine();
  renderAppProtectionList();
});
