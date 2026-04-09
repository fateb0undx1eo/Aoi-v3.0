import { fetchMany, upsertRows } from '../database/repository.js';

export class StaffRatingService {
  async addRating(guildId, staffUserId, reviewerUserId, stars, reviewText) {
    return upsertRows('staff_ratings', {
      guild_id: guildId,
      staff_user_id: staffUserId,
      reviewer_user_id: reviewerUserId,
      stars,
      review_text: reviewText
    });
  }

  async getLeaderboard(guildId, limit = 10) {
    const rows = await fetchMany('staff_ratings', (table) =>
      table
        .select('staff_user_id,stars')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
    );

    const map = new Map();
    for (const row of rows) {
      const current = map.get(row.staff_user_id) ?? { total: 0, count: 0 };
      current.total += row.stars;
      current.count += 1;
      map.set(row.staff_user_id, current);
    }

    return [...map.entries()]
      .map(([staffUserId, data]) => ({
        staffUserId,
        averageStars: Number((data.total / data.count).toFixed(2)),
        ratingsCount: data.count
      }))
      .sort((a, b) => b.averageStars - a.averageStars)
      .slice(0, limit);
  }
}
