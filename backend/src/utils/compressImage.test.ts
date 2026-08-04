import { describe, expect, it, vi } from 'vitest';

import { BadRequestError } from './errors.js';
import { compressIconImage, compressImage } from './compressImage.js';

const { decodeMock } = vi.hoisted(() => ({
  decodeMock: vi.fn(),
}));

vi.mock('@cf-wasm/photon', () => ({
  PhotonImage: {
    new_from_byteslice: decodeMock,
  },
  SamplingFilter: {
    Lanczos3: 0,
  },
  crop: vi.fn(),
  resize: vi.fn(),
}));

const oversizedImage = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.jpg', {
  type: 'image/jpeg',
});

describe('画像圧縮', () => {
  it.each([
    ['投稿画像', compressImage],
    ['アイコン画像', compressIconImage],
  ])('%sが10MBを超える場合はデコード前に拒否する', async (_, compress) => {
    await expect(compress(oversizedImage)).rejects.toEqual(
      new BadRequestError('画像ファイルのサイズは10MB以下にしてください．')
    );
    expect(decodeMock).not.toHaveBeenCalled();
  });
});
