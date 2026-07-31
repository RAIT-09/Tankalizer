import { PhotonImage, SamplingFilter, crop, resize } from '@cf-wasm/photon';

interface CompressionOptions {
  targetFileSize: number;
  width: number;
  height: number;
  cropToSquare: boolean;
}

const QUALITY_LEVELS = [80, 55, 30] as const;

const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/');
};

const bytesToFile = (bytes: Uint8Array, originalFile: File): File => {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return new File([arrayBuffer], originalFile.name, { type: 'image/jpeg' });
};

const compressImageWithOptions = async (file: File, options: CompressionOptions): Promise<File> => {
  if (!isImageFile(file)) {
    throw new Error('ファイルが画像ではありません');
  }

  const images: PhotonImage[] = [];

  try {
    const sourceImage = PhotonImage.new_from_byteslice(
      new Uint8Array(await file.arrayBuffer())
    );
    images.push(sourceImage);

    let preparedImage = sourceImage;
    if (options.cropToSquare) {
      const cropSize = Math.min(sourceImage.get_width(), sourceImage.get_height());
      const x = Math.floor((sourceImage.get_width() - cropSize) / 2);
      const y = Math.floor((sourceImage.get_height() - cropSize) / 2);
      preparedImage = crop(sourceImage, x, y, x + cropSize, y + cropSize);
      images.push(preparedImage);
    }

    const scale = Math.min(
      options.width / preparedImage.get_width(),
      options.height / preparedImage.get_height()
    );
    const resizedImage = resize(
      preparedImage,
      Math.max(1, Math.round(preparedImage.get_width() * scale)),
      Math.max(1, Math.round(preparedImage.get_height() * scale)),
      SamplingFilter.Lanczos3
    );
    images.push(resizedImage);

    let compressedBytes = resizedImage.get_bytes_jpeg(QUALITY_LEVELS[0]);
    for (const quality of QUALITY_LEVELS.slice(1)) {
      if (compressedBytes.byteLength <= options.targetFileSize) {
        break;
      }
      compressedBytes = resizedImage.get_bytes_jpeg(quality);
    }

    return bytesToFile(compressedBytes, file);
  } finally {
    for (let index = images.length - 1; index >= 0; index--) {
      images[index].free();
    }
  }
};

export const compressImage = async (file: File): Promise<File> => {
  return compressImageWithOptions(file, {
    targetFileSize: 500 * 1024,
    width: 1080,
    height: 1080,
    cropToSquare: false,
  });
};

export const compressIconImage = async (file: File): Promise<File> => {
  return compressImageWithOptions(file, {
    targetFileSize: 100 * 1024,
    width: 256,
    height: 256,
    cropToSquare: true,
  });
};
