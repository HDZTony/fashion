import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const DEFAULT_API_URL = 'https://subscription.hdz73.com';
const DEFAULT_CURRENCY = 'CNY';
const DEFAULT_CODE_LENGTH = 20;
const execFileAsync = promisify(execFile);

async function main() {
  const options = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'));
  if (options.help) {
    printHelp();
    return;
  }

  const devVars = await readDevVars('.dev.vars');
  const answers = await collectOptions(options, devVars);
  const apiUrl = stripTrailingSlash(answers.apiUrl || devVars.SUBSCRIPTION_API_URL || DEFAULT_API_URL);
  const adminKey = answers.adminKey || devVars.ADMIN_API_KEY || process.env.ADMIN_API_KEY;
  if (!adminKey) {
    throw new Error('缺少 ADMIN_API_KEY。请在 .dev.vars 中配置，或用 --admin-key 传入。');
  }

  const faceValueCents = amountToCents(answers.amount);
  const productId =
    answers.productId || buildProductId({ credits: answers.credits, faceValueCents, currency: answers.currency });
  const productName = answers.productName || `${formatAmount(answers.amount)} ${answers.currency}`;
  const outPath = resolve(
    answers.out ||
      `card-keys-${sanitizeFilename(productId)}-${new Date().toISOString().slice(0, 10)}.txt`
  );

  const body = {
    productId,
    productName,
    count: answers.count,
    credits: answers.credits,
    faceValueCents,
    currency: answers.currency,
    expiresAt: answers.expiresAt || null,
    codeLength: answers.codeLength,
  };

  const { text, meta } = await generateTxt({ apiUrl, adminKey, body });
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, text, 'utf8');

  console.log('卡密 TXT 已生成');
  console.log(`文件: ${outPath}`);
  console.log(`批次: ${meta.batchId}`);
  console.log(`数量: ${meta.count || answers.count}`);
  console.log(`金额: ${formatAmount(answers.amount)} ${answers.currency} (${faceValueCents} cents)`);
  console.log(`credits: ${answers.credits}（兑换后写入账户）`);
  if (meta.filename) {
    console.log(`Worker 文件名: ${meta.filename}`);
  }
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const readValue = () => {
      const value = args[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} 需要一个值`);
      }
      i += 1;
      return value;
    };

    switch (arg) {
      case '--count':
      case '-n':
        options.count = toInteger(readValue(), 'count');
        break;
      case '--amount':
      case '-a':
        options.amount = toNumber(readValue(), 'amount');
        break;
      case '--credits':
      case '-c':
        options.credits = toInteger(readValue(), 'credits');
        break;
      case '--product-id':
        options.productId = readValue();
        break;
      case '--product-name':
        options.productName = readValue();
        break;
      case '--currency':
        options.currency = readValue().toUpperCase();
        break;
      case '--expires-at':
        options.expiresAt = readValue();
        break;
      case '--code-length':
        options.codeLength = toInteger(readValue(), 'codeLength');
        break;
      case '--out':
      case '-o':
        options.out = readValue();
        break;
      case '--api-url':
        options.apiUrl = readValue();
        break;
      case '--admin-key':
        options.adminKey = readValue();
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`未知参数: ${arg}`);
    }
  }
  return options;
}

async function collectOptions(options, devVars) {
  if (options.count !== undefined && options.amount !== undefined && options.credits !== undefined) {
    const currency = options.currency || DEFAULT_CURRENCY;
    const credits = options.credits;
    const amount = options.amount;
    const faceValueCents = amountToCents(amount);
    const productId = options.productId || buildProductId({ credits, faceValueCents, currency });
    return {
      count: ensurePositiveInteger(options.count, 'count'),
      amount: ensurePositiveNumber(amount, 'amount'),
      credits: ensurePositiveInteger(credits, 'credits'),
      productId,
      productName: options.productName || `${formatAmount(amount)} ${currency}`,
      currency,
      expiresAt: options.expiresAt,
      codeLength: options.codeLength || DEFAULT_CODE_LENGTH,
      out:
        options.out ||
        `card-keys-${sanitizeFilename(productId)}-${new Date().toISOString().slice(0, 10)}.txt`,
      apiUrl: options.apiUrl || devVars.SUBSCRIPTION_API_URL || DEFAULT_API_URL,
      adminKey: options.adminKey,
    };
  }

  const rl = createInterface({ input, output });
  try {
    const currency = await promptString(rl, '币种', options.currency || DEFAULT_CURRENCY);
    const count = await promptInteger(rl, '卡密数量', options.count);
    const amount = await promptNumber(rl, '购买金额（元，例如 5）', options.amount);
    const credits = await promptInteger(rl, '兑换金额 credits（元，通常等于购买金额）', options.credits);
    const expiresAt = await promptString(rl, '过期时间 ISO，可留空', options.expiresAt || '');
    const productId = options.productId || buildProductId({ credits, faceValueCents: amountToCents(amount), currency });
    const productName = options.productName || `${formatAmount(amount)} ${currency}`;
    const out =
      options.out ||
      `card-keys-${sanitizeFilename(productId)}-${new Date().toISOString().slice(0, 10)}.txt`;

    return {
      count,
      amount,
      credits,
      productId: await promptString(rl, '商品ID', productId),
      productName: await promptString(rl, '商品名', productName),
      currency,
      expiresAt: expiresAt || undefined,
      codeLength: options.codeLength || DEFAULT_CODE_LENGTH,
      out: await promptString(rl, '输出 TXT 文件', out),
      apiUrl: options.apiUrl || devVars.SUBSCRIPTION_API_URL || DEFAULT_API_URL,
      adminKey: options.adminKey,
    };
  } finally {
    rl.close();
  }
}

async function generateTxt({ apiUrl, adminKey, body }) {
  const url = `${apiUrl}/admin/card-key-batches/generate-txt`;
  const request = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': adminKey,
    },
    body: JSON.stringify(body),
  };

  try {
    const response = await fetch(url, request);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`生成失败 HTTP ${response.status}: ${text}`);
    }

    return {
      text,
      meta: {
        batchId: response.headers.get('X-Card-Key-Batch-Id') || '',
        count: response.headers.get('X-Card-Key-Count') || '',
        filename: parseContentDispositionFilename(response.headers.get('Content-Disposition')),
      },
    };
  } catch (error) {
    if (process.platform !== 'win32' || isHttpGenerationError(error)) {
      throw error;
    }
    return generateTxtWithPowerShell({ url, adminKey, body, cause: error });
  }
}

async function generateTxtWithPowerShell({ url, adminKey, body, cause }) {
  const script = `
$ErrorActionPreference = 'Stop'
$headers = @{ 'Content-Type' = 'application/json'; 'X-Admin-Key' = $env:CARD_KEY_ADMIN_KEY }
$response = Invoke-WebRequest -Uri $env:CARD_KEY_API_URL -Method Post -Headers $headers -Body $env:CARD_KEY_BODY -UseBasicParsing
$payload = @{
  statusCode = [int]$response.StatusCode
  body = $response.Content
  batchId = [string]$response.Headers['X-Card-Key-Batch-Id']
  count = [string]$response.Headers['X-Card-Key-Count']
  contentDisposition = [string]$response.Headers['Content-Disposition']
}
$payload | ConvertTo-Json -Compress
`;
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        env: {
          ...process.env,
          CARD_KEY_API_URL: url,
          CARD_KEY_ADMIN_KEY: adminKey,
          CARD_KEY_BODY: JSON.stringify(body),
        },
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    const result = JSON.parse(stdout.trim());
    return {
      text: result.body,
      meta: {
        batchId: result.batchId || '',
        count: result.count || '',
        filename: parseContentDispositionFilename(result.contentDisposition || ''),
      },
    };
  } catch (fallbackError) {
    const causeMessage = cause?.cause?.message || cause?.message || String(cause);
    throw new Error(
      `生成失败。Node fetch 错误: ${causeMessage}; PowerShell fallback 错误: ${fallbackError.message}`
    );
  };
}

function isHttpGenerationError(error) {
  return error instanceof Error && error.message.startsWith('生成失败 HTTP ');
}

async function readDevVars(path) {
  try {
    const content = await readFile(path, 'utf8');
    const vars = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
    return vars;
  } catch {
    return {};
  }
}

async function promptString(rl, label, defaultValue) {
  const answer = await rl.question(`${label}${defaultValue ? ` [${defaultValue}]` : ''}: `);
  return answer.trim() || defaultValue;
}

async function promptInteger(rl, label, defaultValue) {
  while (true) {
    const raw = await promptString(rl, label, defaultValue === undefined ? '' : String(defaultValue));
    const value = toInteger(raw, label);
    if (value > 0) return value;
    console.log(`${label} 必须大于 0`);
  }
}

async function promptNumber(rl, label, defaultValue) {
  while (true) {
    const raw = await promptString(rl, label, defaultValue === undefined ? '' : String(defaultValue));
    const value = toNumber(raw, label);
    if (value > 0) return value;
    console.log(`${label} 必须大于 0`);
  }
}

function toInteger(value, label) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue)) {
    throw new Error(`${label} 必须是整数`);
  }
  return numberValue;
}

function toNumber(value, label) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${label} 必须是数字`);
  }
  return numberValue;
}

function ensurePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} 必须是大于 0 的整数`);
  }
  return value;
}

function ensurePositiveNumber(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} 必须是大于 0 的数字`);
  }
  return value;
}

function amountToCents(amount) {
  return Math.round(amount * 100);
}

function formatAmount(amount) {
  return amount.toFixed(2).replace(/\.00$/, '');
}

function buildProductId({ credits, faceValueCents, currency }) {
  return `manual-${credits}-credits-${faceValueCents}-${currency.toLowerCase()}`;
}

function sanitizeFilename(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80) || 'card-keys';
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function parseContentDispositionFilename(value) {
  if (!value) return null;
  const match = value.match(/filename="([^"]+)"/i) || value.match(/filename=([^;]+)/i);
  return match?.[1] || null;
}

function printHelp() {
  console.log(`生成卡密 TXT

交互式:
  pnpm card-keys:txt

参数式:
  pnpm card-keys:txt -- --count 100 --amount 5 --credits 5 --out card-keys.txt

常用参数:
  --count, -n       卡密数量
  --amount, -a      购买金额，单位为元，会保存为卡密 faceValueCents
  --credits, -c     兑换金额，单位为元；Wormhole 账户按此值入账
  --out, -o         输出 TXT 文件
  --product-id      商品 ID；不填则自动生成
  --product-name    商品名；不填则自动生成
  --expires-at      过期时间 ISO，例如 2027-01-01T00:00:00Z
  --code-length     卡密长度，默认 ${DEFAULT_CODE_LENGTH}
  --api-url         Worker 地址
  --admin-key       管理密钥；默认读取 .dev.vars 的 ADMIN_API_KEY
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
