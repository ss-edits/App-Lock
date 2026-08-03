/**
 * Aegis Offline AES-256 Encrypted Media Vault Engine
 * Stores sensitive photos and videos in an encrypted IndexedDB sandbox.
 * Zero files touch the cloud or remain unencrypted on disk.
 */

class MediaVaultEngine {
  constructor() {
    this.dbName = 'AegisSecureVaultDB';
    this.dbVersion = 1;
    this.db = null;
    this.cryptoKey = null;
  }

  async init() {
    await this.openDB();
    await this.loadOrGenerateVaultKey();
  }

  /**
   * Open IndexedDB client-side database
   */
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('vault_items')) {
          db.createObjectStore('vault_items', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[MediaVault] IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * AES-GCM 256-bit Web Crypto Key Management
   */
  async loadOrGenerateVaultKey() {
    const storedKeyRaw = localStorage.getItem('aegis_vault_key_raw');
    if (storedKeyRaw) {
      const jwk = JSON.parse(storedKeyRaw);
      this.cryptoKey = await crypto.subtle.importKey(
        'jwk', jwk, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
      );
    } else {
      this.cryptoKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
      );
      const exported = await crypto.subtle.exportKey('jwk', this.cryptoKey);
      localStorage.setItem('aegis_vault_key_raw', JSON.stringify(exported));
    }
  }

  /**
   * Encrypt and store a File object into IndexedDB
   */
  async importAndEncryptFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      this.cryptoKey,
      arrayBuffer
    );

    const vaultItem = {
      name: file.name,
      mimeType: file.type,
      size: file.size,
      iv: Array.from(iv),
      encryptedData: encryptedBuffer,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('vault_items', 'readwrite');
      const store = tx.objectStore('vault_items');
      const req = store.add(vaultItem);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieve all encrypted items metadata from Vault
   */
  getAllItems() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('vault_items', 'readonly');
      const store = tx.objectStore('vault_items');
      const req = store.getAll();
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Decrypt an encrypted vault item in-memory and return a temporary Blob URL
   */
  async decryptToBlobUrl(item) {
    try {
      const ivArray = new Uint8Array(item.iv);
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivArray },
        this.cryptoKey,
        item.encryptedData
      );

      const blob = new Blob([decryptedBuffer], { type: item.mimeType });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('[MediaVault] Decryption failure:', err);
      return null;
    }
  }

  /**
   * Delete an item from the Vault
   */
  deleteItem(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('vault_items', 'readwrite');
      const store = tx.objectStore('vault_items');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(false);
    });
  }

  /**
   * Revoke memory references when closing viewer
   */
  revokeBlobUrl(url) {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}

window.MediaVaultEngine = MediaVaultEngine;
