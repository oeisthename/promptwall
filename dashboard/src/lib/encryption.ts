import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

// Helper to get a stable 32-byte key from the environment variable
function getEncryptionKey(): Buffer {
  const secret = process.env.MASTER_ENCRYPTION_KEY || "default_development_key_change_me_in_production";
  return crypto.createHash("sha256").update(String(secret)).digest();
}

/**
 * Encrypts a plaintext string using AES-256-CBC.
 * Returns a string in the format "iv:encryptedData".
 */
export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a string in the format "iv:encryptedData" using AES-256-CBC.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(":")) return encryptedText;
  
  try {
    const [ivHex, dataHex] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(dataHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    // If we can't decrypt it (e.g., key changed), return an error string or empty
    return "";
  }
}
