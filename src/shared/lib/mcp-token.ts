/**
 * MCP Token 加密工具
 * - Token 格式：cmu_<random 24 bytes hex>
 * - 存储：AES-256-GCM 加密 + SHA-256 哈希（快速查找）
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// 加密密钥（必须通过环境变量 MCP_TOKEN_KEY 配置）
function getEncryptionKey(): Buffer {
  const key = process.env.MCP_TOKEN_KEY;
  
  if (!key) {
    // 开发环境：允许使用基于数据库路径的派生密钥
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[mcp-token] Warning: MCP_TOKEN_KEY not set, using derived key for development');
      return createHash('sha256')
        .update(`teamclaw-dev-key-${process.cwd()}`)
        .digest();
    }
    
    // 生产环境：强制要求配置
    throw new Error(
      'MCP_TOKEN_KEY environment variable is required in production. ' +
      'Generate a secure key with: openssl rand -hex 32'
    );
  }
  
  // 验证密钥长度（至少 32 字节）
  if (key.length < 32) {
    throw new Error('MCP_TOKEN_KEY must be at least 32 characters long');
  }
  
  return createHash('sha256').update(key).digest();
}

// 延迟初始化密钥，避免模块加载时立即报错
let _encryptionKey: Buffer | null = null;

function getOrCreateEncryptionKey(): Buffer {
  if (!_encryptionKey) {
    _encryptionKey = getEncryptionKey();
  }
  return _encryptionKey;
}

// Token 前缀：cmu = TeamClaw User
const TOKEN_PREFIX = 'cmu_';

/**
 * 生成新的 MCP Token
 */
export function generateMcpToken(): string {
  const randomPart = randomBytes(24).toString('hex');
  return `${TOKEN_PREFIX}${randomPart}`;
}

/**
 * 计算 Token 的 SHA-256 哈希（用于数据库快速查找）
 */
export function hashMcpToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * AES-256-GCM 加密 Token
 */
export function encryptMcpToken(token: string): string {
  const key = getOrCreateEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // 格式：iv(24 hex) + authTag(32 hex) + encrypted
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

/**
 * AES-256-GCM 解密 Token
 */
export function decryptMcpToken(encryptedData: string): string | null {
  try {
    const key = getOrCreateEncryptionKey();
    const iv = Buffer.from(encryptedData.slice(0, 24), 'hex');
    const authTag = Buffer.from(encryptedData.slice(24, 56), 'hex');
    const encrypted = encryptedData.slice(56);
    
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * 验证 Token 格式
 */
export function isValidMcpTokenFormat(token: string): boolean {
  // cmu_ + 48 hex chars = 52 chars total
  return token.startsWith(TOKEN_PREFIX) && 
         token.length === 52 && 
         /^cmu_[0-9a-f]{48}$/.test(token);
}

/**
 * Token 脱敏显示（只显示前后各 4 个字符）
 */
export function maskMcpToken(token: string): string {
  if (token.length <= 12) return '****';
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}
