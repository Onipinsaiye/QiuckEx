import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TransactionItem, TransactionResponse } from '../types/transaction';

const TRANSACTIONS_CACHE_KEY_PREFIX = '@qex_tx_cache_';
const PROFILE_CACHE_KEY_PREFIX = '@qex_profile_cache_';

/**
 * Saves transactions for a specific account to the local cache.
 */
export async function saveTransactionsToCache(accountId: string, data: TransactionResponse): Promise<void> {
    try {
        const cacheEntry = {
            data,
            timestamp: Date.now(),
        };
        await AsyncStorage.setItem(`${TRANSACTIONS_CACHE_KEY_PREFIX}${accountId}`, JSON.stringify(cacheEntry));
    } catch (err) {
        console.error('Failed to save transactions to cache', err);
    }
}

/**
 * Retrieves cached transactions for a specific account.
 * Returns null if no cache is found.
 */
export async function getTransactionsFromCache(accountId: string): Promise<TransactionResponse | null> {
    try {
        const raw = await AsyncStorage.getItem(`${TRANSACTIONS_CACHE_KEY_PREFIX}${accountId}`);
        if (!raw) return null;
        
        const entry = JSON.parse(raw);
        return entry.data;
    } catch (err) {
        console.error('Failed to get transactions from cache', err);
        return null;
    }
}

/**
 * Simple cache invalidation: clears data older than 7 days.
 */
/**
 * Searches all cached transaction responses for a specific transaction by pagingToken.
 * Returns the matching TransactionItem or null if not found.
 */
export async function findTransactionInCache(
    pagingToken: string,
): Promise<TransactionItem | null> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter((k) =>
            k.startsWith(TRANSACTIONS_CACHE_KEY_PREFIX),
        );

        for (const key of cacheKeys) {
            const raw = await AsyncStorage.getItem(key);
            if (!raw) continue;
            const entry = JSON.parse(raw) as {
                data: TransactionResponse;
                timestamp: number;
            };
            const match = entry.data.items.find(
                (item) => item.pagingToken === pagingToken,
            );
            if (match) return match;
        }
        return null;
    } catch (err) {
        console.error('Failed to find transaction in cache', err);
        return null;
    }
}

/**
 * Searches all cached transaction responses for transactions that share a
 * source or destination address with the given transaction.
 *
 * Used by the "Related Transactions" section of the transaction detail screen
 * (#97).
 */
export async function findRelatedTransactions(params: {
    source?: string;
    destination?: string;
    excludeTxHash?: string;
    limit?: number;
}): Promise<TransactionItem[]> {
    const { source, destination, excludeTxHash, limit = 10 } = params;
    if (!source && !destination) return [];

    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter((k) =>
            k.startsWith(TRANSACTIONS_CACHE_KEY_PREFIX),
        );

        const matched: TransactionItem[] = [];

        for (const key of cacheKeys) {
            if (matched.length >= limit) break;
            const raw = await AsyncStorage.getItem(key);
            if (!raw) continue;
            const entry = JSON.parse(raw) as {
                data: TransactionResponse;
                timestamp: number;
            };

            for (const item of entry.data.items) {
                if (item.txHash === excludeTxHash) continue;
                const addressMatch =
                    (source      && (item.source === source      || item.destination === source))      ||
                    (destination && (item.source === destination || item.destination === destination));
                if (addressMatch) {
                    matched.push(item);
                    if (matched.length >= limit) break;
                }
            }
        }

        // Sort most recent first
        matched.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

        return matched;
    } catch (err) {
        console.error('Failed to find related transactions in cache', err);
        return [];
    }
}

export async function invalidateOldCache(): Promise<void> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(k => k.startsWith(TRANSACTIONS_CACHE_KEY_PREFIX) || k.startsWith(PROFILE_CACHE_KEY_PREFIX));
        
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        
        for (const key of cacheKeys) {
            const raw = await AsyncStorage.getItem(key);
            if (raw) {
                const entry = JSON.parse(raw);
                if (now - entry.timestamp > sevenDaysMs) {
                    await AsyncStorage.removeItem(key);
                }
            }
        }
    } catch (err) {
        console.error('Failed to invalidate old cache', err);
    }
}
