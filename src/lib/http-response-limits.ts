export class ResponseSizeLimitError extends Error {
  constructor(readonly maximumBytes: number) {
    super(`Provider response exceeded ${maximumBytes} bytes.`);
    this.name = 'ResponseSizeLimitError';
  }
}

export async function readResponseBufferWithLimit(
  response: Response,
  maximumBytes: number
) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ResponseSizeLimitError(maximumBytes);
  }

  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel('response-size-limit');
        throw new ResponseSizeLimitError(maximumBytes);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}
