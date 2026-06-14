import { fetchMany, upsertRows } from '../database/repository.js';

interface RatingEntry {
  staff_user_id: string;
  total: number;
  count: number;
}

interface LeaderboardEntry {
  staffUserId: string;
  averageStars: number;
  ratingsCount: number;
}

export class StaffRatingService {
  async addRating(guildId: string, staffUserId: string, reviewerUserId: string, stars: number, reviewText: string): Promise<void> {
    return upsertRows('staff_ratings', {
      guild_id: guildId,
      staff_user_id: staffUserId,
      reviewer_user_id: reviewerUserId,
      stars,
      review_text: reviewText,
    });
  }

  async getLeaderboard(guildId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    const rows: any[] = await fetchMany<any>('staff_ratings', (table: any) =>
      (table as any)
        .select('staff_user_id,stars')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
    );

    const map = new Map<string, RatingEntry>();
    for (const row of rows) {
      const current = map.get(row.staff_user_id) ?? { total: 0, count: 0 } as RatingEntry;
      current.total += row.stars;
      current.count += 1;
      map.set(row.staff_user_id, current);
    }

    return [...map.entries()]
      .map(([staffUserId, data]) => ({
        staffUserId,
        averageStars: Number((data.total / data.count).toFixed(2)),
        ratingsCount: data.count,
      }))
      .sort((a, b) => b.averageStars - a.averageStars)
      .slice(0, limit);
  }
}
