import crypto from 'node:crypto';

/**
 * A credential is the employee's Bale user id plus a version, encrypted with AES-256-GCM.
 * GCM authenticates, so a credential cannot be forged or edited without the server key.
 * Bumping the stored version (Reissue) invalidates every older credential for that user.
 *
 * Wire format: base64url(iv[12] || tag[16] || ciphertext).
 */
export interface CredentialPayload {
  userId: string;
  version: number;
}

export class CredentialCodec {
  private readonly key: Buffer;

  constructor(keyHex: string) {
    if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
      throw new Error('CREDENTIAL_KEY must be 64 hex characters (32 bytes)');
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  encode(payload: CredentialPayload): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const plain = Buffer.from(JSON.stringify({ u: payload.userId, v: payload.version }));
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64url');
  }

  decode(token: string): CredentialPayload | null {
    try {
      const raw = Buffer.from(token, 'base64url');
      if (raw.length < 12 + 16 + 2) return null;
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
      const obj = JSON.parse(plain.toString('utf8')) as { u?: unknown; v?: unknown };
      if (typeof obj.u !== 'string' || typeof obj.v !== 'number') return null;
      return { userId: obj.u, version: obj.v };
    } catch {
      return null;
    }
  }
}
