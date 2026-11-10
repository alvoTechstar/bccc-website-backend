export function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) {
    throw new Error("Phone number is required");
  }

  // Remove any non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  if (!cleaned) {
    throw new Error("Phone number must contain digits");
  }

  // Handle Kenyan numbers
  if (cleaned.startsWith("0")) {
    return "254" + cleaned.substring(1);
  } else if (cleaned.startsWith("254")) {
    return cleaned;
  } else if (cleaned.startsWith("7") && cleaned.length === 9) {
    return "254" + cleaned;
  }

  if (cleaned.length === 9 && /^[7][0-9]{8}$/.test(cleaned)) {
    return "254" + cleaned;
  }

  if (cleaned.length === 12 && cleaned.startsWith("254")) {
    return cleaned;
  }

  throw new Error(`Unable to format phone number: ${phone}. Expected Kenyan format.`);
}

export function isValidPhoneNumber(phone: string | undefined | null): boolean {
  if (!phone) return false;

  const cleaned = phone.replace(/\D/g, "");

  const patterns = [
    /^0[7][0-9]{8}$/, // 0712345678
    /^254[7][0-9]{8}$/, // 254712345678
    /^[7][0-9]{8}$/, // 712345678
  ];

  return patterns.some((pattern) => pattern.test(cleaned));
}

// Helper to display user-friendly phone numbers
export function displayPhoneNumber(phone: string): string {
  try {
    const formatted = formatPhoneNumber(phone);
    return `+${formatted}`;
  } catch {
    return phone;
  }
}
