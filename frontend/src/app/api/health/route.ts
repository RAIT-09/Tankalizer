// ALBヘルスチェック用。認証やDBに依存せず稼働中サーバーの200応答だけを返す
export const dynamic = 'force-dynamic';

export function GET() {
  return new Response('ok', { status: 200 });
}
