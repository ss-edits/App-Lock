/**
 * App Lock Security Authentication & Cryptography Engine
 * Fully offline client-side authentication using Web Crypto SHA-256,
 * 3x3 Canvas Pattern Tracker with Invisible Trail support, Biometric Simulation, and Brute Force Lockouts.
 */

class AuthEngine {
  constructor() {
    this.failedAttempts = JSON.parse(localStorage.getItem('applock_failed_attempts') || '{}');
    this.lockouts = JSON.parse(localStorage.getItem('applock_lockouts') || '{}');
    this.activeTimerInterval = null;
    
    // Ensure default Master Backup Recovery code exists in storage (default: 'applock2026')
    this.initMasterPassword();
  }

  async initMasterPassword() {
    if (!localStorage.getItem('applock_master_hash')) {
      const defaultHash = await this.hashData('applock2026');
      localStorage.setItem('applock_master_hash', defaultHash);
    }
  }

  /**
   * Secure SHA-256 hashing using browser Web Crypto API
   */
  async hashData(inputString) {
    const encoder = new TextEncoder();
    const data = encoder.encode(inputString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify an authenticator credential against a stored hash or default testing credentials
   */
  async verifyCredential(appId, attemptValue, lockType, configuredHash) {
    // Check if app is currently locked out from brute force attempts
    if (this.isAppLockedOut(appId)) {
      return { success: false, lockedOut: true, remainingSecs: this.getRemainingLockoutSecs(appId) };
    }

    const inputHash = await this.hashData(attemptValue);
    
    // In our live demo simulator, if custom hash not set, default PIN is '2026', Pattern is '0,1,2,5,8', Password is 'apple'
    let targetHash = configuredHash;
    if (!targetHash) {
      if (lockType === 'pin') targetHash = await this.hashData('2026');
      else if (lockType === 'pattern') targetHash = await this.hashData('0,1,2,5,8');
      else if (lockType === 'password') targetHash = await this.hashData('apple');
      else if (lockType === 'biometrics') return { success: true };
    }

    const isMatch = (inputHash === targetHash);

    if (!isMatch) {
      this.recordFailedAttempt(appId);
      const lockedNow = this.isAppLockedOut(appId);
      return { 
        success: false, 
        lockedOut: lockedNow, 
        remainingSecs: lockedNow ? 30 : 0,
        attemptsLeft: 5 - (this.failedAttempts[appId] || 0)
      };
    }

    // Success! Reset attempts for this app
    this.clearFailedAttempts(appId);
    return { success: true };
  }

  async verifyMasterRecovery(inputString) {
    const masterHash = localStorage.getItem('applock_master_hash');
    const inputHash = await this.hashData(inputString);
    return inputHash === masterHash;
  }

  async setMasterRecovery(newPassword) {
    const newHash = await this.hashData(newPassword);
    localStorage.setItem('applock_master_hash', newHash);
    return true;
  }

  /* ==========================================================================
     Brute-Force Shield (5 Tries -> 30s Lockout Timer)
     ========================================================================== */
  recordFailedAttempt(appId) {
    const current = (this.failedAttempts[appId] || 0) + 1;
    this.failedAttempts[appId] = current;
    localStorage.setItem('applock_failed_attempts', JSON.stringify(this.failedAttempts));

    if (current >= 5) {
      const unlockTime = Date.now() + 30000;
      this.lockouts[appId] = unlockTime;
      localStorage.setItem('applock_lockouts', JSON.stringify(this.lockouts));
    }
  }

  clearFailedAttempts(appId) {
    delete this.failedAttempts[appId];
    delete this.lockouts[appId];
    localStorage.setItem('applock_failed_attempts', JSON.stringify(this.failedAttempts));
    localStorage.setItem('applock_lockouts', JSON.stringify(this.lockouts));
  }

  isAppLockedOut(appId) {
    const expiry = this.lockouts[appId];
    if (!expiry) return false;
    if (Date.now() >= expiry) {
      this.clearFailedAttempts(appId);
      return false;
    }
    return true;
  }

  getRemainingLockoutSecs(appId) {
    const expiry = this.lockouts[appId];
    if (!expiry) return 0;
    const diff = Math.ceil((expiry - Date.now()) / 1000);
    return Math.max(0, diff);
  }

  startLockoutTimerDisplay(appId, onUpdate, onExpire) {
    if (this.activeTimerInterval) clearInterval(this.activeTimerInterval);

    this.activeTimerInterval = setInterval(() => {
      const secs = this.getRemainingLockoutSecs(appId);
      if (secs <= 0) {
        clearInterval(this.activeTimerInterval);
        this.activeTimerInterval = null;
        this.clearFailedAttempts(appId);
        onExpire();
      } else {
        onUpdate(secs);
      }
    }, 500);
  }

  /* ==========================================================================
     WebAuthn / Biometric Authenticator
     ========================================================================== */
  async triggerBiometricUnlock(appId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, method: 'biometric-simulated' });
      }, 1400);
    });
  }
}

/* ==========================================================================
   3x3 Canvas Pattern Lock Engine with "Invisible Path" Toggle
   ========================================================================== */
class PatternLock {
  constructor(canvasElement, onComplete, options = { invisible: false }) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.onComplete = onComplete;
    this.invisible = options.invisible;
    
    this.nodes = [];
    this.selectedNodes = [];
    this.isDrawing = false;
    this.currentPos = { x: 0, y: 0 };

    this.initCanvas();
    this.bindEvents();
  }

  initCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    this.width = rect.width;
    this.height = rect.height;

    this.nodes = [];
    const pad = 45;
    const spacingX = (this.width - pad * 2) / 2;
    const spacingY = (this.height - pad * 2) / 2;

    let idx = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        this.nodes.push({
          id: idx++,
          x: pad + c * spacingX,
          y: pad + r * spacingY,
          selected: false
        });
      }
    }
    this.draw();
  }

  setInvisible(value) {
    this.invisible = value;
    this.draw();
  }

  bindEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    };

    const start = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      this.selectedNodes = [];
      this.nodes.forEach(n => n.selected = false);
      const pos = getPos(e);
      this.currentPos = pos;
      this.checkIntersection(pos);
      this.draw();
    };

    const move = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      this.currentPos = pos;
      this.checkIntersection(pos);
      this.draw();
    };

    const end = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.isDrawing = false;
      this.draw();
      if (this.selectedNodes.length > 0 && this.onComplete) {
        const patternString = this.selectedNodes.map(n => n.id).join(',');
        this.onComplete(patternString);
      }
    };

    this.canvas.addEventListener('mousedown', start);
    this.canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);

    this.canvas.addEventListener('touchstart', start, { passive: false });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
  }

  checkIntersection(pos) {
    const hitRadius = 26;
    for (const node of this.nodes) {
      if (!node.selected) {
        const dist = Math.hypot(node.x - pos.x, node.y - pos.y);
        if (dist <= hitRadius) {
          node.selected = true;
          this.selectedNodes.push(node);
          if (navigator.vibrate) navigator.vibrate(25);
        }
      }
    }
  }

  draw(error = false) {
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (!this.invisible && this.selectedNodes.length > 0) {
      this.ctx.beginPath();
      this.ctx.strokeStyle = error ? '#FF3B30' : '#00C7FF';
      this.ctx.lineWidth = 4;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.shadowBlur = 14;
      this.ctx.shadowColor = error ? '#FF3B30' : '#00C7FF';

      this.selectedNodes.forEach((node, i) => {
        if (i === 0) this.ctx.moveTo(node.x, node.y);
        else this.ctx.lineTo(node.x, node.y);
      });

      if (this.isDrawing && !error) {
        this.ctx.lineTo(this.currentPos.x, this.currentPos.y);
      }
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }

    for (const node of this.nodes) {
      this.ctx.beginPath();
      if (node.selected) {
        this.ctx.fillStyle = error ? '#FF3B30' : (this.invisible ? '#FFF' : '#00C7FF');
        this.ctx.arc(node.x, node.y, 9, 0, Math.PI * 2);
        this.ctx.fill();

        if (!this.invisible) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = error ? 'rgba(255,59,48,0.35)' : 'rgba(0,199,255,0.35)';
          this.ctx.lineWidth = 2;
          this.ctx.arc(node.x, node.y, 22, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      } else {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        this.ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  showErrorAndReset() {
    this.draw(true);
    setTimeout(() => {
      this.selectedNodes = [];
      this.nodes.forEach(n => n.selected = false);
      this.draw();
    }, 450);
  }

  reset() {
    this.selectedNodes = [];
    this.nodes.forEach(n => n.selected = false);
    this.draw();
  }
}

window.AuthEngine = AuthEngine;
window.PatternLock = PatternLock;
