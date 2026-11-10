// M-Pesa helpers (Daraja timestamps / passwords are EAT-based).

// Get current timestamp in M-Pesa format (EAT timezone, YYYYMMDDHHmmss)
export function getTimestamp(): string {
  const now = new Date();
  // Convert to EAT (UTC+3) for M-Pesa
  const eatTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const year = eatTime.getUTCFullYear();
  const month = (eatTime.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = eatTime.getUTCDate().toString().padStart(2, "0");
  const hours = eatTime.getUTCHours().toString().padStart(2, "0");
  const minutes = eatTime.getUTCMinutes().toString().padStart(2, "0");
  const seconds = eatTime.getUTCSeconds().toString().padStart(2, "0");

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// Generate M-Pesa password
export function generateMpesaPassword(shortCode: string, passKey: string): string {
  const timestamp = getTimestamp();
  const concatenated = shortCode + passKey + timestamp;
  return Buffer.from(concatenated).toString("base64");
}
