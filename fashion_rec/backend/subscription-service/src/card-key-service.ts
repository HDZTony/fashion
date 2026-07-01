import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SubscriptionService } from './subscription-service';

const CARD_KEY_BATCHES_TABLE = 'card_key_batches';
const CARD_KEYS_TABLE = 'card_keys';
const CARD_KEY_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DEFAULT_CODE_LENGTH = 20;
const MIN_CODE_LENGTH = 8;
const MAX_CODE_LENGTH = 64;
const MAX_GENERATE_COUNT = 5000;

type CardKeyStatus = 'available' | 'redeemed' | 'disabled' | 'expired';
type CardKeySource = 'generated' | 'txt_import';

interface CardKeyRecord {
  id: string;
  batch_id: string | null;
  product_id: string;
  credits: number;
  face_value_cents: number | null;
  currency: string;
  status: CardKeyStatus;
  valid_from: string | null;
  expires_at: string | null;
  redeemed_by_user_id: string | null;
  redeemed_at: string | null;
}

export interface GenerateCardKeysInput {
  productId: string;
  productName?: string | null;
  count: number;
  credits: number;
  faceValueCents?: number | null;
  currency?: string | null;
  validFrom?: string | null;
  expiresAt?: string | null;
  codeLength?: number;
}

export interface ImportCardKeysInput {
  productId: string;
  productName?: string | null;
  text: string;
  credits: number;
  faceValueCents?: number | null;
  currency?: string | null;
  validFrom?: string | null;
  expiresAt?: string | null;
}

export interface ImportedInvalidLine {
  line: number;
  code: string;
  reason: string;
}

export interface CardKeyBatchResult {
  batchId: string;
  productId: string;
  productName: string | null;
  credits: number;
  faceValueCents: number | null;
  currency: string;
  validFrom: string | null;
  expiresAt: string | null;
}

export interface GeneratedCardKeysResult extends CardKeyBatchResult {
  count: number;
  codes: string[];
}

export interface ImportedCardKeysResult extends CardKeyBatchResult {
  inserted: number;
  duplicates: number;
  invalidLines: ImportedInvalidLine[];
}

export interface RedeemCardKeyResult {
  creditsAdded: number;
  credits: number;
  productId: string;
  batchId: string | null;
  redeemedAt: string;
}

export class CardKeyError extends Error {
  code: string;
  status: 400 | 401 | 403 | 404 | 409 | 410 | 500;

  constructor(
    code: string,
    message: string,
    status: 400 | 401 | 403 | 404 | 409 | 410 | 500
  ) {
    super(message);
    this.name = 'CardKeyError';
    this.code = code;
    this.status = status;
  }
}

export class CardKeyService {
  private client: SupabaseClient;
  private subscriptionService: SubscriptionService;
  private hashSecret: string;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    hashSecret: string,
    subscriptionService: SubscriptionService
  ) {
    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    this.subscriptionService = subscriptionService;
    this.hashSecret = hashSecret;
  }

  async generateCardKeys(input: GenerateCardKeysInput): Promise<GeneratedCardKeysResult> {
    const normalized = this.validateBatchInput(input);
    const count = this.validateCount(input.count);
    const codeLength = this.validateCodeLength(input.codeLength ?? DEFAULT_CODE_LENGTH);
    const batch = await this.createBatch({
      ...normalized,
      source: 'generated',
      totalCount: count,
    });

    const codes = new Set<string>();
    while (codes.size < count) {
      codes.add(this.generateCode(codeLength));
    }

    const rows = await Promise.all(
      [...codes].map(async (code) => this.toCardKeyInsertRow(code, batch.batchId, normalized))
    );

    const { error } = await this.client.from(CARD_KEYS_TABLE).insert(rows);
    if (error) {
      throw new CardKeyError('card_key_insert_failed', error.message, 500);
    }

    return {
      ...batch,
      count,
      codes: [...codes],
    };
  }

  async importCardKeys(input: ImportCardKeysInput): Promise<ImportedCardKeysResult> {
    const normalized = this.validateBatchInput(input);
    const parsed = this.parseImportText(input.text);
    if (parsed.validCodes.length === 0) {
      throw new CardKeyError('no_valid_card_keys', 'No valid card keys found in import text', 400);
    }

    const hashedCodes = await Promise.all(
      parsed.validCodes.map(async (code) => ({
        code,
        codeHash: await this.hashCardKey(code),
      }))
    );
    const existingHashes = await this.findExistingHashes(hashedCodes.map((item) => item.codeHash));
    const insertable = hashedCodes.filter((item) => !existingHashes.has(item.codeHash));

    const batch = await this.createBatch({
      ...normalized,
      source: 'txt_import',
      totalCount: insertable.length,
    });

    if (insertable.length > 0) {
      const rows = insertable.map((item) =>
        this.toCardKeyInsertRowFromHash(item.code, item.codeHash, batch.batchId, normalized)
      );
      const { error } = await this.client.from(CARD_KEYS_TABLE).insert(rows);
      if (error) {
        throw new CardKeyError('card_key_insert_failed', error.message, 500);
      }
    }

    return {
      ...batch,
      inserted: insertable.length,
      duplicates: parsed.duplicates + existingHashes.size,
      invalidLines: parsed.invalidLines,
    };
  }

  async redeemCardKey(userId: string, code: string): Promise<RedeemCardKeyResult> {
    const normalizedCode = this.normalizeCode(code);
    this.assertValidCode(normalizedCode);
    const codeHash = await this.hashCardKey(normalizedCode);

    const { data, error } = await this.client
      .from(CARD_KEYS_TABLE)
      .select('*')
      .eq('code_hash', codeHash)
      .single();

    if (error || !data) {
      if (error?.code !== 'PGRST116') {
        console.warn('Card key lookup failed:', error);
      }
      throw new CardKeyError('invalid_card_key', 'Invalid card key', 404);
    }

    const record = data as CardKeyRecord;
    this.assertRedeemable(record);

    const redeemedAt = new Date().toISOString();
    const { data: redeemedRecord, error: redeemError } = await this.client
      .from(CARD_KEYS_TABLE)
      .update({
        status: 'redeemed',
        redeemed_by_user_id: userId,
        redeemed_at: redeemedAt,
        updated_at: redeemedAt,
      })
      .eq('id', record.id)
      .eq('status', 'available')
      .select('*')
      .single();

    if (redeemError || !redeemedRecord) {
      throw new CardKeyError('already_redeemed', 'Card key has already been redeemed', 409);
    }

    let newCredits: number;
    try {
      newCredits = await this.subscriptionService.addTries(userId, record.credits);
    } catch (error) {
      await this.client
        .from(CARD_KEYS_TABLE)
        .update({
          status: 'available',
          redeemed_by_user_id: null,
          redeemed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id)
        .eq('redeemed_by_user_id', userId);
      throw error;
    }

    return {
      creditsAdded: record.credits,
      credits: newCredits,
      productId: record.product_id,
      batchId: record.batch_id,
      redeemedAt,
    };
  }

  private validateBatchInput(input: {
    productId: string;
    productName?: string | null;
    credits: number;
    faceValueCents?: number | null;
    currency?: string | null;
    validFrom?: string | null;
    expiresAt?: string | null;
  }) {
    const productId = String(input.productId || '').trim();
    if (!productId) {
      throw new CardKeyError('product_id_required', 'productId is required', 400);
    }
    const credits = Number(input.credits);
    if (!Number.isInteger(credits) || credits <= 0) {
      throw new CardKeyError('invalid_credits', 'credits must be a positive integer', 400);
    }
    const faceValueCents =
      input.faceValueCents === undefined || input.faceValueCents === null
        ? null
        : Number(input.faceValueCents);
    if (faceValueCents !== null && (!Number.isInteger(faceValueCents) || faceValueCents < 0)) {
      throw new CardKeyError('invalid_face_value', 'faceValueCents must be a non-negative integer', 400);
    }
    const currency = String(input.currency || 'USD').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new CardKeyError('invalid_currency', 'currency must be a 3-letter ISO code', 400);
    }

    const validFrom = this.validateOptionalDate(input.validFrom, 'validFrom');
    const expiresAt = this.validateOptionalDate(input.expiresAt, 'expiresAt');
    if (validFrom && expiresAt && new Date(validFrom) >= new Date(expiresAt)) {
      throw new CardKeyError('invalid_time_range', 'validFrom must be before expiresAt', 400);
    }

    return {
      productId,
      productName: input.productName ? String(input.productName).trim() : null,
      credits,
      faceValueCents,
      currency,
      validFrom,
      expiresAt,
    };
  }

  private validateCount(count: number): number {
    const normalized = Number(count);
    if (!Number.isInteger(normalized) || normalized <= 0 || normalized > MAX_GENERATE_COUNT) {
      throw new CardKeyError(
        'invalid_count',
        `count must be an integer between 1 and ${MAX_GENERATE_COUNT}`,
        400
      );
    }
    return normalized;
  }

  private validateCodeLength(codeLength: number): number {
    const normalized = Number(codeLength);
    if (!Number.isInteger(normalized) || normalized < MIN_CODE_LENGTH || normalized > MAX_CODE_LENGTH) {
      throw new CardKeyError(
        'invalid_code_length',
        `codeLength must be an integer between ${MIN_CODE_LENGTH} and ${MAX_CODE_LENGTH}`,
        400
      );
    }
    return normalized;
  }

  private validateOptionalDate(value: string | null | undefined, fieldName: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new CardKeyError('invalid_date', `${fieldName} must be a valid date`, 400);
    }
    return date.toISOString();
  }

  private async createBatch(input: {
    productId: string;
    productName: string | null;
    credits: number;
    faceValueCents: number | null;
    currency: string;
    validFrom: string | null;
    expiresAt: string | null;
    source: CardKeySource;
    totalCount: number;
  }): Promise<CardKeyBatchResult> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from(CARD_KEY_BATCHES_TABLE)
      .insert({
        product_id: input.productId,
        product_name: input.productName,
        credits: input.credits,
        face_value_cents: input.faceValueCents,
        currency: input.currency,
        valid_from: input.validFrom,
        expires_at: input.expiresAt,
        source: input.source,
        total_count: input.totalCount,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new CardKeyError('batch_create_failed', error?.message || 'Failed to create card key batch', 500);
    }

    return {
      batchId: data.id,
      productId: data.product_id,
      productName: data.product_name,
      credits: data.credits,
      faceValueCents: data.face_value_cents,
      currency: data.currency,
      validFrom: data.valid_from,
      expiresAt: data.expires_at,
    };
  }

  private async toCardKeyInsertRow(
    code: string,
    batchId: string,
    input: ReturnType<CardKeyService['validateBatchInput']>
  ) {
    return this.toCardKeyInsertRowFromHash(code, await this.hashCardKey(code), batchId, input);
  }

  private toCardKeyInsertRowFromHash(
    code: string,
    codeHash: string,
    batchId: string,
    input: ReturnType<CardKeyService['validateBatchInput']>
  ) {
    const now = new Date().toISOString();
    return {
      batch_id: batchId,
      product_id: input.productId,
      credits: input.credits,
      face_value_cents: input.faceValueCents,
      currency: input.currency,
      code_hash: codeHash,
      code_last4: code.slice(-4),
      status: 'available',
      valid_from: input.validFrom,
      expires_at: input.expiresAt,
      created_at: now,
      updated_at: now,
    };
  }

  private parseImportText(text: string) {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new CardKeyError('import_text_required', 'text is required', 400);
    }

    const seen = new Set<string>();
    const validCodes: string[] = [];
    const invalidLines: ImportedInvalidLine[] = [];
    let duplicates = 0;

    text.split(/\r?\n/).forEach((line, index) => {
      const raw = line.trim();
      if (!raw) return;

      const code = this.normalizeCode(raw);
      if (!this.isValidCode(code)) {
        invalidLines.push({
          line: index + 1,
          code: raw,
          reason: `Only ${MIN_CODE_LENGTH}-${MAX_CODE_LENGTH} uppercase letters and digits are allowed`,
        });
        return;
      }

      if (seen.has(code)) {
        duplicates += 1;
        return;
      }

      seen.add(code);
      validCodes.push(code);
    });

    return { validCodes, invalidLines, duplicates };
  }

  private async findExistingHashes(codeHashes: string[]): Promise<Set<string>> {
    const existing = new Set<string>();
    const chunkSize = 500;
    for (let i = 0; i < codeHashes.length; i += chunkSize) {
      const chunk = codeHashes.slice(i, i + chunkSize);
      const { data, error } = await this.client
        .from(CARD_KEYS_TABLE)
        .select('code_hash')
        .in('code_hash', chunk);
      if (error) {
        throw new CardKeyError('card_key_lookup_failed', error.message, 500);
      }
      for (const row of data || []) {
        existing.add(row.code_hash);
      }
    }
    return existing;
  }

  private assertRedeemable(record: CardKeyRecord): void {
    const now = new Date();
    if (record.status === 'redeemed') {
      throw new CardKeyError('already_redeemed', 'Card key has already been redeemed', 409);
    }
    if (record.status === 'disabled') {
      throw new CardKeyError('disabled_card_key', 'Card key is disabled', 409);
    }
    if (record.status === 'expired') {
      throw new CardKeyError('expired_card_key', 'Card key has expired', 410);
    }
    if (record.valid_from && new Date(record.valid_from) > now) {
      throw new CardKeyError('card_key_not_active', 'Card key is not active yet', 409);
    }
    if (record.expires_at && new Date(record.expires_at) <= now) {
      void this.client
        .from(CARD_KEYS_TABLE)
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('id', record.id)
        .eq('status', 'available');
      throw new CardKeyError('expired_card_key', 'Card key has expired', 410);
    }
    if (!Number.isInteger(record.credits) || record.credits <= 0) {
      throw new CardKeyError('invalid_card_key_value', 'Card key value is invalid', 500);
    }
  }

  private generateCode(length: number): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let result = '';
    for (const byte of bytes) {
      result += CARD_KEY_ALPHABET[byte % CARD_KEY_ALPHABET.length];
    }
    return result;
  }

  private normalizeCode(code: string): string {
    return String(code || '').trim().toUpperCase();
  }

  private assertValidCode(code: string): void {
    if (!this.isValidCode(code)) {
      throw new CardKeyError('invalid_format', 'Card key must contain only letters and digits', 400);
    }
  }

  private isValidCode(code: string): boolean {
    return new RegExp(`^[A-Z0-9]{${MIN_CODE_LENGTH},${MAX_CODE_LENGTH}}$`).test(code);
  }

  private async hashCardKey(code: string): Promise<string> {
    const payload = new TextEncoder().encode(`${this.hashSecret}:${code}`);
    const digest = await crypto.subtle.digest('SHA-256', payload);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
