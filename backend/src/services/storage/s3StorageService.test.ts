import type { AwsClient } from 'aws4fetch';
import { describe, expect, it, vi } from 'vitest';

import { S3StorageService } from './s3StorageService.js';

describe('S3StorageService', () => {
  it('キーをパスセグメントごとにエンコードしてオブジェクトURLを生成する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const aws = { fetch: fetchMock } as unknown as AwsClient;
    const service = new S3StorageService(aws, 'bucket', 'cdn.example.com');

    await service.download('images/短歌 #?+.jpg');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://bucket.s3.ap-northeast-1.amazonaws.com/images/%E7%9F%AD%E6%AD%8C%20%23%3F%2B.jpg',
      { method: 'GET' }
    );
  });
});
