import { describe, expect, it, vi } from 'vitest';
import { fetchDistrictOptions, fetchProvinceOptions } from './location-service';

describe('Portföy Uzmanı konum seçenekleri', () => {
  it('81 ili sabit izinli API adresinden alır ve yalnız gerekli alanları döndürür', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        data: [
          { id: 34, name: 'İstanbul', population: 99 },
          { id: 6, name: 'Ankara', population: 88 },
        ],
      })
    );

    await expect(fetchProvinceOptions(fetcher)).resolves.toEqual([
      { id: 6, name: 'Ankara' },
      { id: 34, name: 'İstanbul' },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.turkiyeapi.dev/v2/provinces?fields=id%2Cname&limit=100',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('ilçeleri yalnız doğrulanmış il kimliğiyle ister', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ data: [{ id: 431, name: 'Kadıköy' }] })
    );

    await expect(fetchDistrictOptions(34, fetcher)).resolves.toEqual([
      { id: 431, name: 'Kadıköy' },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.turkiyeapi.dev/v2/provinces/34/districts?fields=id%2Cname&limit=1000',
      expect.any(Object)
    );
    await expect(fetchDistrictOptions(0, fetcher)).rejects.toThrow(
      'Geçerli bir il seçin'
    );
  });

  it('beklenmeyen harici API yanıtını kullanıcıya taşımadan reddeder', async () => {
    const fetcher = vi.fn(async () => Response.json({ data: 'bozuk' }));
    await expect(fetchProvinceOptions(fetcher)).rejects.toThrow(
      'Konum seçenekleri alınamadı'
    );
  });
});
