import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { generateBannerbearSlideshow } from './bannerbear-video';

describe('generateBannerbearSlideshow', () => {
  it('gerçek fotoğrafları dikey MP4 slayt görevine gönderir ve tamamlanan sonucu döndürür', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        uid: 'video-job-a',
        tool: 'create_video_slideshow',
        status: 'pending',
      }), { status: 202, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        uid: 'video-job-a',
        tool: 'create_video_slideshow',
        status: 'running',
        progress: 55,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        uid: 'video-job-a',
        tool: 'create_video_slideshow',
        status: 'completed',
        progress: 100,
        outputs: { video_url: 'https://videos.bannerbear.com/video-job-a.mp4' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const onSubmitted = vi.fn();
    const onProgress = vi.fn();

    const result = await generateBannerbearSlideshow({
      apiKey: 'test-key',
      imageUrls: [
        'https://blob.example.com/property-1.jpg',
        'https://blob.example.com/property-2.jpg',
      ],
      format: 'story',
      slideDuration: 3,
      transition: 'fade',
      metadata: 'company-a',
      onSubmitted,
      onProgress,
    }, {
      fetcher: fetcher as typeof fetch,
      sleeper: vi.fn().mockResolvedValue(undefined),
      now: () => 1_000,
    });

    expect(result).toEqual({
      videoUrl: 'https://videos.bannerbear.com/video-job-a.mp4',
      providerRequestId: 'video-job-a',
      durationSeconds: 6,
    });
    expect(onSubmitted).toHaveBeenCalledWith('video-job-a');
    expect(onProgress).toHaveBeenCalledWith(55, 'running');
    const createBody = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(createBody).toMatchObject({
      image_urls: [
        'https://blob.example.com/property-1.jpg',
        'https://blob.example.com/property-2.jpg',
      ],
      width: 1080,
      height: 1920,
      slide_duration: 3,
      transition: 'fade',
    });
  });

  it('video araçları yetkisi olmayan anahtarı anlaşılır biçimde reddeder', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await expect(generateBannerbearSlideshow({
      apiKey: 'limited-key',
      imageUrls: ['https://a.test/1.jpg', 'https://a.test/2.jpg'],
      format: 'post',
      slideDuration: 3,
      transition: 'fade',
      metadata: '',
    }, { fetcher: fetcher as typeof fetch })).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });

  it('iki fotoğraftan az girdide ücretli isteği başlatmaz', async () => {
    const fetcher = vi.fn();
    await expect(generateBannerbearSlideshow({
      apiKey: 'test-key',
      imageUrls: ['https://a.test/1.jpg'],
      format: 'post',
      slideDuration: 3,
      transition: 'fade',
      metadata: '',
    }, { fetcher: fetcher as typeof fetch })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
