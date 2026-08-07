import { describe, expect, it } from 'vitest';
import {
  readResponseBufferWithLimit,
  ResponseSizeLimitError,
} from './http-response-limits';

describe('readResponseBufferWithLimit', () => {
  it('reads a provider response below the configured limit', async () => {
    const response = new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-length': '3' },
    });

    await expect(readResponseBufferWithLimit(response, 4)).resolves.toEqual(
      Buffer.from([1, 2, 3])
    );
  });

  it('rejects a response whose declared length exceeds the limit', async () => {
    const response = new Response(new Uint8Array([1]), {
      headers: { 'content-length': '10' },
    });

    await expect(readResponseBufferWithLimit(response, 4)).rejects.toBeInstanceOf(
      ResponseSizeLimitError
    );
  });

  it('rejects a streamed response that grows beyond the limit', async () => {
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.enqueue(new Uint8Array([4, 5]));
          controller.close();
        },
      })
    );

    await expect(readResponseBufferWithLimit(response, 4)).rejects.toBeInstanceOf(
      ResponseSizeLimitError
    );
  });
});
