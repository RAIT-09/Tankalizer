import type { IStorageService } from '../storage/iStorageService.js';
import type { IIconService } from './iIconService.js';
import { generateUuid } from '../../utils/generateUuid.js';

// バケット内のアイコンを保存するルートパス
const ICON_STORAGE_PATH = 'icon';

export class IconService implements IIconService {
  constructor(private readonly storageService: IStorageService) {}
  /**
   * アイコンをアップロードする
   * @param file
   * @param userId
   */
  async updatedIcon(file: File, userId: string): Promise<string> {
    // ファイル名を生成
    const fileName = this.generateFileName(file, userId);

    // ストレージにアップロード
    const key = await this.storageService.upload(file, fileName);

    return key;
  }

  /**
   * ユーザIDからアイコンを取得する
   * @param userId
   */
  async getIcon(userId: string): Promise<Uint8Array> {
    // TODO : DBからユーザアイコンのURLを取得
    const icon_url = '';
    return await this.storageService.download(icon_url);
  }

  /**
   * ファイル名を生成する
   * @param file - ファイル名を生成するファイル
   * @param userId - ユーザID
   * @returns ファイル名
   */
  generateFileName(file: File, userId: string): string {
    // userIdでアイコンを保存するディレクトリを作成
    const directory = `${ICON_STORAGE_PATH}/${userId}`;

    // ファイルネームを生成
    const uuid = generateUuid();
    const fileName = `${directory}/${uuid}.${file.type.split('/')[1]}`;
    return fileName;
  }
}
