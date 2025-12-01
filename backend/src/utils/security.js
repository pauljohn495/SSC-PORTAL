import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config/index.js';

const SALT_ROUNDS = 12;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const ENCRYPTED_PREFIX = 'enc:';

let cachedKey;
let missingKeyWarned = false;

const getEncryptionKey = () => {
  if (cachedKey !== undefined) {
    return cachedKey;
  }

  const rawKey = config.security?.encryptionKey;
  if (!rawKey) {
    cachedKey = null;
    if (!missingKeyWarned) {
      console.warn('ENCRYPTION_KEY is not configured. Sensitive tokens will be stored in plaintext.');
      missingKeyWarned = true;
    }
    return cachedKey;
  }

  const normalized = rawKey.trim();
  if (/^[0-9a-f]{64}$/i.test(normalized)) {
    cachedKey = Buffer.from(normalized, 'hex');
  } else {
    // Derive a 32-byte key from any arbitrary secret
    cachedKey = crypto.createHash('sha256').update(normalized).digest();
  }
  return cachedKey;
};

export const hashPassword = async (password) => {
  if (!password) {
    return password;
  }
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

export const comparePassword = (candidate, hashedPassword) => {
  if (!candidate || !hashedPassword) {
    return false;
  }
  return bcrypt.compare(candidate, hashedPassword);
};

const tokenPepper = config.security?.tokenPepper || '';

export const hashToken = (token) => {
  if (!token) {
    return null;
  }
  return crypto.createHash('sha256').update(`${token}${tokenPepper}`).digest('hex');
};

export const createSecureToken = (byteLength = 32) => {
  const token = crypto.randomBytes(byteLength).toString('hex');
  return {
    token,
    hashedToken: hashToken(token)
  };
};

export const encryptText = (value) => {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  const key = getEncryptionKey();
  if (!key) {
    return value;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decryptText = (value) => {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  const key = getEncryptionKey();
  if (!key) {
    console.warn('Attempted to decrypt an encrypted value but ENCRYPTION_KEY is missing.');
    return null;
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length);
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    return null;
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
};


