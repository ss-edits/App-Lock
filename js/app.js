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
    'banking': { id: 'banking', name: 'Global Banking', category: 'Finance', icon: '🏛️', color: '#0071E3', locked: true, lockType: 'pin', invisiblePattern: false },
    'whatsapp': { id: 'whatsapp', name: 'WhatsApp', category: 'Messaging', icon: '💬', color: '#25D366', locked: true, lockType: 'pattern', invisiblePattern: true },
    'gallery': { id: 'gallery', name: 'Photo Gallery', category: 'Media', icon: '🖼️', color: '#FF9F0A', locked: true, lockType: 'password', invisiblePattern: false },
    'instagram': { id: 'instagram', name: 'Instagram', category: 'Social', icon: '📸', color: '#E1306C', locked: true, lockType: 'biometrics', invisiblePattern: false },
    'telegram': { id: 'telegram', name: 'Telegram', category: 'Messaging', icon: '✈️', color: '#0088CC', locked: false, lockType: 'pin', invisiblePattern: false },
    'settings': { id: 'settings', name: 'Device Settings', category: 'System', icon: '⚙️', color: '#8E8E93', locked: true, lockType: 'pin', invisiblePattern: false },
    'gmail': { id: 'gmail', name: 'Work Mail', category: 'Productivity', icon: '📧', color: '#EA4335', locked: false, lockType: 'pattern', invisiblePattern: false },
    'tiktok': { id: 'tiktok', name: 'TikTok', category: 'Social', icon: '🎵', color: '#000000', locked: false, lockType: 'pin', invisiblePattern: false }
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

  function renderAppProtectionList() {
    if (!appsGrid) return;
    appsGrid.innerHTML = '';

    Object.values(appConfigs).forEach(app => {
      const card = document.createElement('div');
      card.className = `app-card ${app.locked ? 'locked-active' : ''}`;
      card.innerHTML = `
        <div class="app-card-header">
          <div class="app-meta">
            <div class="app-icon-wrapper" style="background-color: ${app.color}">${app.icon}</div>
            <div class="app-title-box">
              <h4>${app.name}</h4>
              <div class="app-category">${app.category}</div>
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
    document.getElementById('viewer-dummy-content').innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
        <div style="font-size: 48px; margin-bottom: 16px;">${app.icon}</div>
        <h3 style="color: #FFF; font-family: var(--font-heading); margin-bottom: 8px;">Welcome to ${app.name}</h3>
        <p>You have successfully unlocked this secure environment. All actions inside remain protected by App Lock.</p>
      </div>
    `;
    sandboxModal.classList.add('active-modal');
  }

  document.getElementById('btn-close-app-viewer').addEventListener('click', () => {
    document.getElementById('app-viewer-modal').classList.remove('active-modal');
  });

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
