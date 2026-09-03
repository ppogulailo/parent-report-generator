import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AES-256-GCM encryption for the one sensitive free-text field this product
 * stores: the parent's urgent-concern note.
 *
 * Why application-layer rather than the ORM: neither Prisma nor Postgres
 * encrypts a column transparently. Fly's managed Postgres encrypts the
 * underlying volume, which protects against disk theft but not against anything
 * that can already run a SELECT. Encrypting in the app means a database dump,
 * a log leak, or a read-only analytics connection cannot read the urgent note.
 *
 * GCM rather than CBC so tampering is detected rather than silently decrypted
 * into garbage.
 *
 * Format: `v1.<iv-b64>.<tag-b64>.<ciphertext-b64>`. The version prefix exists so
 * a future key rotation can re-encrypt in place while still reading old rows.
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const TAG_BYTES = 16;

@Injectable()
export class FieldEncryptionService {
  private readonly logger = new Logger(FieldEncryptionService.name);
  private readonly key: Buffer | null;

  constructor(private readonly config: ConfigService) {
    // Fail SOFT, unlike the Sustaining Recovery FRAAP this is ported from:
    // there the database is the product's memory and a missing key is a boot
    // failure; here persistence arrived in Milestone 5 as a bonus on top of a
    // working product, and a missing key must degrade to "plans generated
    // unsaved", never to "no parent can take the assessment". A submission
    // carrying an urgent note refuses to save rather than saving plaintext —
    // encrypt() throws, PlanService catches, the parent still gets their plan.
    const raw = this.config.get<string>('FIELD_ENCRYPTION_KEY');
    if (!raw) {
      this.key = null;
      this.logger.warn(
        'FIELD_ENCRYPTION_KEY is not set — a submission carrying an urgent note cannot be saved. Generate one with: openssl rand -base64 32',
      );
      return;
    }
    const key = Buffer.from(raw, 'base64');

    if (key.length !== KEY_BYTES) {
      throw new Error(
        `FIELD_ENCRYPTION_KEY must be ${KEY_BYTES} bytes base64-encoded ` +
          `(got ${key.length}). Generate one with: openssl rand -base64 32`,
      );
    }

    this.key = key;
    this.logger.log('field encryption ready (aes-256-gcm)');
  }

  /** Returns null for null/empty input so an absent field stays absent. */
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined || plaintext === '') {
      return null;
    }
    if (!this.key) {
      // Refusing to save beats saving in the clear, every time.
      throw new Error('FIELD_ENCRYPTION_KEY is not configured');
    }

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      VERSION,
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join('.');
  }

  /**
   * Returns null for null input. Throws on a malformed or tampered value rather
   * than returning a partial result — silently serving corrupted text to a
   * parent, or to the client's review team, would be worse than an error.
   */
  decrypt(encrypted: string | null | undefined): string | null {
    if (encrypted === null || encrypted === undefined || encrypted === '') {
      return null;
    }
    if (!this.key) {
      throw new Error('FIELD_ENCRYPTION_KEY is not configured');
    }

    const parts = encrypted.split('.');
    if (parts.length !== 4) {
      throw new Error(
        'encrypted field is malformed: expected 4 dot-separated parts',
      );
    }

    const [version, ivB64, tagB64, ciphertextB64] = parts;
    if (version !== VERSION) {
      throw new Error(`unsupported encrypted field version "${version}"`);
    }

    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    if (iv.length !== IV_BYTES) {
      throw new Error('encrypted field is malformed: bad iv length');
    }
    if (tag.length !== TAG_BYTES) {
      throw new Error('encrypted field is malformed: bad auth tag length');
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    try {
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextB64, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // GCM auth failure. Deliberately vague — the detail is not actionable to a
      // caller and the plaintext must not appear in an error message.
      throw new Error(
        'encrypted field failed authentication (wrong key or tampered)',
      );
    }
  }

  /** Constant-time comparison, for anything that ever needs to match a token. */
  static safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
