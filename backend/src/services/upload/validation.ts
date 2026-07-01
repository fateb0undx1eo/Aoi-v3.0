export interface ValidationOptions {
  maxFileSizeBytes: number;
  bannedExtensions: string[];
}

export interface ValidationResult {
  valid: boolean;
  sanitizedName: string;
  reason?: string;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/ /g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
}

export function validateFile(
  originalname: string,
  size: number,
  options: ValidationOptions,
): ValidationResult {
  const sanitizedName = sanitizeFilename(originalname);

  if (!sanitizedName) {
    return { valid: false, sanitizedName, reason: 'Filename is empty after sanitization' };
  }

  if (size <= 0) {
    return { valid: false, sanitizedName, reason: 'File is empty' };
  }

  if (size > options.maxFileSizeBytes) {
    return { valid: false, sanitizedName, reason: `File exceeds ${options.maxFileSizeBytes} byte limit` };
  }

  const ext = sanitizedName.slice(sanitizedName.lastIndexOf('.')).toLowerCase();
  if (options.bannedExtensions.includes(ext)) {
    return { valid: false, sanitizedName, reason: `File extension "${ext}" is banned` };
  }

  return { valid: true, sanitizedName };
}
