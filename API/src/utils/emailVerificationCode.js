import crypto from 'node:crypto';

// A six-digit code has only one million possibilities, so plain SHA-256
// cannot protect it against an offline database leak
// Reuse the server's validated AUTH_SECRET as a key, and separate this
// purpose from JWTs and media links with an explicit domain prefix
export function hashEmailVerificationCode(code) {
  const secret=process.env.AUTH_SECRET || 'development-only-secret-change-me';
  return crypto.createHmac('sha256',secret)
    .update('circle:email-verification:v2\n'+String(code))
    .digest('hex');
}

function equalHex(left,right) {
  if(!/^[0-9a-f]{64}$/i.test(String(left)) ||
     !/^[0-9a-f]{64}$/i.test(String(right))) return false;
  return crypto.timingSafeEqual(
    Buffer.from(left,'hex'),
    Buffer.from(right,'hex'),
  );
}

export function matchesEmailVerificationCode(code,storedHash) {
  if(typeof code!=='string'||!/^\d{6}$/.test(code))return false;
  const expected=hashEmailVerificationCode(code);
  if(equalHex(expected,storedHash))return true;
  // Existing codes were SHA-256 hashes; accept them only while their
  // regular 20-minute database expiry still permits verification
  const legacy=crypto.createHash('sha256').update(code).digest('hex');
  return equalHex(legacy,storedHash);
}
