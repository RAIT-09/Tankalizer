import type { AwsClient } from 'aws4fetch';

import type { IStorageService } from './iStorageService.js';

export class S3StorageService implements IStorageService {
  constructor(
    private readonly aws: AwsClient,
    private readonly bucketName: string,
    private readonly cdnUrl: string
  ) {}

  async upload(file: File, key: string): Promise<string> {
    const response = await this.aws.fetch(this.getObjectUrl(key), {
      method: 'PUT',
      body: await file.arrayBuffer(),
      headers: {
        'content-type': file.type,
      },
    });

    if (!response.ok) {
      throw new Error('ファイルのアップロードに失敗しました');
    }

    return key;
  }

  async download(key: string): Promise<Uint8Array> {
    const response = await this.aws.fetch(this.getObjectUrl(key), { method: 'GET' });

    if (!response.ok) {
      throw new Error('ファイルが見つかりません');
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  getUrl(key: string): string {
    return `https://${this.cdnUrl}/${key}`;
  }

  private getObjectUrl(key: string): string {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `https://${this.bucketName}.s3.ap-northeast-1.amazonaws.com/${encodedKey}`;
  }
}
