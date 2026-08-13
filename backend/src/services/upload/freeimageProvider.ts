const MB = 1024 * 1024;

export const freeimageProvider = {
  name: 'freeimage' as const,
  maxFileSizeBytes: 10 * MB,

  async upload(
    buffer: Buffer,
    filename: string,
    options?: { apiKey?: string; signal?: AbortSignal },
  ): Promise<string> {
    const apiKey = options?.apiKey ?? process.env.FREEIMAGE_API_KEY;

    const form = new FormData();
    form.append('key', apiKey);
    form.append('action', 'upload');
    form.append('format', 'json');
    form.append('source', new Blob([buffer as BlobPart], { type: 'image/png' }), filename);

    const response = await fetch('https://freeimage.host/api/1/upload', {
      method: 'POST',
      body: form,
      signal: options?.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`FreeImage HTTP ${response.status}: ${body}`);
    }

    const json = (await response.json()) as any;
    if (json?.status_code !== 200) {
      throw new Error(`FreeImage upload failed: ${json?.status_txt ?? JSON.stringify(json)}`);
    }

    const url: string | undefined =
      json?.image?.url ?? json?.image?.display_url ?? json?.image?.url_short;
    if (!url || !/^https?:\/\//.test(url)) {
      throw new Error('FreeImage upload failed: no direct image url in response');
    }

    return url.trim();
  },
};
