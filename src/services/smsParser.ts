/**
 * On-device bank-SMS parser (free tier).
 *
 * Extracts a structured transaction from a bank SMS using regex only — no
 * server AI. The server then categorizes (rules + heuristics), dedupes and
 * inserts. Used when the user is on the free tier; premium uses the richer
 * AI parse on the server.
 *
 * Intentionally conservative: returns null unless it finds both an amount and a
 * debit/credit direction, so junk SMS are skipped rather than mis-saved.
 */

export interface ParsedSmsTransaction {
  bank: string;
  account_number: string;
  account_type: 'credit_card' | 'savings';
  transaction_type: 'debit' | 'credit';
  amount: number;
  currency: string;
  merchant: string;
  description: string;
  date: string;
  reference_number: string | null;
  source: 'sms';
}

const CREDIT_CARD_RE = /credit\s*card|cr\.?\s*card|creditcard|card\s+ending|on (?:your )?card|card\s+x+\d|using .*card/i;

interface RawSms {
  sender: string;
  body: string;
  date: string; // ISO string
}

const BANK_PATTERNS: Array<{ re: RegExp; bank: string }> = [
  { re: /hdfc/i, bank: 'hdfc' },
  { re: /\bsbi\b|sbiinb|state bank/i, bank: 'sbi' },
  { re: /icici/i, bank: 'icici' },
  { re: /axis/i, bank: 'axis' },
  { re: /kotak/i, bank: 'kotak' },
  { re: /\brbl\b/i, bank: 'rbl' },
  { re: /idfc/i, bank: 'idfc' },
];

const CREDIT_RE = /credited|received|deposited|refund|reversal|cashback|salary|interest credited|added to/i;
const DEBIT_RE = /debited|spent|withdrawn|purchase|paid|sent|deducted|charged|txn of|payment of|debit for/i;

function detectBank(sender: string, body: string): string {
  const hay = `${sender} ${body}`;
  for (const { re, bank } of BANK_PATTERNS) {
    if (re.test(hay)) return bank;
  }
  return 'other';
}

function parseAmount(body: string): number | null {
  // Rs. / INR / ₹ then a number (commas + optional decimals).
  const m = body.match(/(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function detectType(body: string): 'debit' | 'credit' | null {
  // Credit keywords take precedence (e.g. "refund credited").
  if (CREDIT_RE.test(body)) return 'credit';
  if (DEBIT_RE.test(body)) return 'debit';
  return null;
}

function parseAccountLast4(body: string): string {
  const m = body.match(/(?:a\/c|ac|acct|account|card)\s*(?:no\.?|number|ending)?\s*[:\-]?\s*[xX*]*\s*([0-9]{3,4})\b/i);
  return m ? m[1].slice(-4) : '0000';
}

function parseReference(body: string): string | null {
  const m = body.match(/(?:ref(?:erence)?(?:\s*(?:no|number|id))?|upi(?:\s*ref)?|txn(?:\s*id)?|rrn)\s*[:#\-]?\s*([A-Za-z0-9]{6,})/i);
  return m ? m[1] : null;
}

function cleanMerchant(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '')
    .trim()
    .slice(0, 64);
}

function parseMerchant(body: string): string {
  let m = body.match(/\b(?:at|to|towards|in favour of)\s+([A-Za-z0-9@.&'\-/ ]{2,40}?)(?:\s+on\b|\.|,|\s+ref\b|\s+upi\b|\s+info\b|$)/i);
  if (m) return cleanMerchant(m[1]);
  m = body.match(/\bvpa\s+([a-z0-9.\-_@]+)/i);
  if (m) return cleanMerchant(m[1]);
  m = body.match(/\binfo[:\- ]+([A-Za-z0-9@.&'\-/ ]{2,40})/i);
  if (m) return cleanMerchant(m[1]);
  return '';
}

/** Parse a single bank SMS into a structured transaction, or null if not parseable. */
export function parseBankSms(sms: RawSms): ParsedSmsTransaction | null {
  const body = sms.body || '';
  const amount = parseAmount(body);
  const type = detectType(body);
  if (amount === null || type === null) {
    return null;
  }

  const merchant = parseMerchant(body);
  return {
    bank: detectBank(sms.sender || '', body),
    account_number: parseAccountLast4(body),
    account_type: CREDIT_CARD_RE.test(body) ? 'credit_card' : 'savings',
    transaction_type: type,
    amount,
    currency: 'INR',
    merchant,
    description: merchant ? `${type === 'credit' ? 'Credit from' : 'Payment to'} ${merchant}` : 'SMS transaction',
    date: sms.date,
    reference_number: parseReference(body),
    source: 'sms',
  };
}

/** Parse a batch; drops messages that aren't parseable transactions. */
export function parseBankSmsMessages(messages: RawSms[]): ParsedSmsTransaction[] {
  const out: ParsedSmsTransaction[] = [];
  for (const m of messages) {
    const parsed = parseBankSms(m);
    if (parsed) out.push(parsed);
  }
  return out;
}
