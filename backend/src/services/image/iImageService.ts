export interface IImageService {
  uploadImage(file: File): Promise<string>;
  getImage(imageUrl: string): Promise<Uint8Array>;
  isImage(file: File): boolean;
}
