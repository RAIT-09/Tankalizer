export interface IStorageService {
  upload(file: File, key: string): Promise<string>;
  download(key: string): Promise<Uint8Array>;
  getUrl(key: string): string;
}
