let sharpAvailable = true;

export async function stripFileMetadata(buffer: Buffer, mimetype: string): Promise<Buffer> {
  if (!mimetype.startsWith('image/')) return buffer;
  if (!sharpAvailable) return buffer;
  try {
    const sharp = await import('sharp');
    return await sharp(buffer).rotate().toBuffer();
  } catch {
    sharpAvailable = false;
    return buffer;
  }
}
