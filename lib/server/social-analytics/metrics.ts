export type SocialEngagementCounts = { likes: number | null; comments: number | null; shares: number | null };

export function getInteractionsChange(current: SocialEngagementCounts, previous: SocialEngagementCounts) {
  const metrics = ["likes", "comments", "shares"] as const;
  const currentMetrics = metrics.filter((metric) => current[metric] !== null);
  if (currentMetrics.length === 0 || currentMetrics.some((metric) => previous[metric] === null)
    || metrics.some((metric) => current[metric] === null && previous[metric] !== null)) return null;
  return currentMetrics.reduce((total, metric) => total + (current[metric] ?? 0) - (previous[metric] ?? 0), 0);
}
