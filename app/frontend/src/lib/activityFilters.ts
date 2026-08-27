import type { ActivityFeedItem } from '@/hooks/activityFeedApi';

export type ActivityFilterStatus = 'All' | ActivityFeedItem['status'];

export type ActivityFilterState = {
  query: string;
  status: ActivityFilterStatus;
  asset: string;
};

export function filterActivityItems(
  items: ActivityFeedItem[],
  filters: ActivityFilterState,
): ActivityFeedItem[] {
  const query = filters.query.trim().toLowerCase();
  const assetFilter = filters.asset.trim();

  return items.filter((item) => {
    if (filters.status !== 'All' && item.status !== filters.status) {
      return false;
    }

    if (assetFilter !== '' && assetFilter !== 'All' && item.asset.toLowerCase() !== assetFilter.toLowerCase()) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchable = [
      item.id,
      item.amount,
      item.asset,
      item.memo ?? '',
      item.source,
      item.destination,
      item.status,
    ].join(' ').toLowerCase();

    return searchable.includes(query);
  });
}
