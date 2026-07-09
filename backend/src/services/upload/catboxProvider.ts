const MB = 1024 * 1024;

export const catboxProvider = {
  name: 'catbox' as const,
  maxFileSizeBytes: 200 * MB,

  async upload(
    buffer: Buffer,
    filename: string,
    options?: { userHash?: string; signal?: AbortSignal },
  ): Promise<string> {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', new Blob([buffer as BlobPart]), filename);
    if (options?.userHash) {
      form.append('userhash', options.userHash);
    }

    const response = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: form,
      signal: options?.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Catbox HTTP ${response.status}: ${body}`);
    }

    const text = await response.text();
    if (text.startsWith('https://files.catbox.moe/')) {
      return text.trim();
    }

    throw new Error(`Catbox upload failed: ${text}`);
  },
};
