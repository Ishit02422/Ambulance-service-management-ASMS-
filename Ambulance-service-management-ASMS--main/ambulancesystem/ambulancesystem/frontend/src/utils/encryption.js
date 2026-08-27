// AES-256 encryption using Web Crypto API
const ENCRYPTION_KEY_NAME = 'ambulance_enc_key';

// Generate or retrieve encryption key
const getEncryptionKey = async () => {
  let keyData = sessionStorage.getItem(ENCRYPTION_KEY_NAME);
  
  if (!keyData) {
    // Generate a new key for this session
    const key = await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Export and store the key
    const exported = await window.crypto.subtle.exportKey('jwk', key);
    sessionStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(exported));
    return key;
  }
  
  // Import existing key
  const exported = JSON.parse(keyData);
  return await window.crypto.subtle.importKey(
    'jwk',
    exported,
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
};

// Convert string to ArrayBuffer
const str2ab = (str) => {
  const encoder = new TextEncoder();
  return encoder.encode(str);
};

// Convert ArrayBuffer to string
const ab2str = (buffer) => {
  const decoder = new TextDecoder();
  return decoder.decode(buffer);
};

// Convert ArrayBuffer to Base64
const ab2base64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Convert Base64 to ArrayBuffer
const base642ab = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// Encrypt data
export const encrypt = async (data) => {
  try {
    const key = await getEncryptionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for GCM
    const dataBuffer = str2ab(JSON.stringify(data));
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      dataBuffer
    );
    
    // Combine IV and encrypted data
    const encryptedData = {
      iv: ab2base64(iv),
      data: ab2base64(encryptedBuffer)
    };
    
    return btoa(JSON.stringify(encryptedData));
  } catch (error) {
    console.error('Encryption error:', error);
    // Fallback to non-encrypted storage if encryption fails
    return btoa(JSON.stringify(data));
  }
};

// Decrypt data
export const decrypt = async (encryptedData) => {
  try {
    if (!encryptedData) return null;
    
    const key = await getEncryptionKey();
    const parsed = JSON.parse(atob(encryptedData));
    
    const iv = base642ab(parsed.iv);
    const data = base642ab(parsed.data);
    
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );
    
    const decryptedStr = ab2str(decryptedBuffer);
    return JSON.parse(decryptedStr);
  } catch (error) {
    console.error('Decryption error:', error);
    // Try fallback base64 decode
    try {
      return JSON.parse(atob(encryptedData));
    } catch (e) {
      // If both fail, try parsing as plain JSON (old data)
      try {
        return JSON.parse(encryptedData);
      } catch (err) {
        return null;
      }
    }
  }
};

// Clear encryption key (on logout)
export const clearEncryptionKey = () => {
  sessionStorage.removeItem(ENCRYPTION_KEY_NAME);
};
