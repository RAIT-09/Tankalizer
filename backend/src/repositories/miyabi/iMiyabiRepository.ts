export type Miyabi = {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
};

export type RankedPost = {
  rank: number;
  id: string;
  original: string;
  tanka: string[];
  image_path: string | null;
  created_at: string;
  is_developer: boolean;
  user_id: string;
  user_name: string;
  user_icon: string;
  miyabi_count: number;
  is_miyabi: boolean;
};

export interface IMiyabiRepository {
  findMiyabi(userId: string, postId: string): Promise<Miyabi | null>;
  create(userId: string, postId: string): Promise<void>;
  delete(userId: string, postId: string): Promise<number>;
  getMiyabiRanking(limit: number, viewerId?: string): Promise<RankedPost[]>;
}
