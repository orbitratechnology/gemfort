import {
  fetchSellerListingOffers,
  isListingOfferUnread,
} from "@/features/marketplace/marketplace-service";
import { subscribeSellerListingOffers } from "@/features/workspace/firestore-subscriptions";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { useAuth } from "@/providers/auth-provider";
import type { ListingOffer } from "@/types";

/** Live unread offer count for the signed-in seller (Workspace tab badge). */
export function useUnreadListingOfferCount(): number {
  const { user } = useAuth();

  const { data: offers = [] } = useFirestoreLiveQuery({
    queryKey: ["seller-listing-offers", user?.uid],
    queryFn: () => fetchSellerListingOffers(user!.uid),
    subscribe: (onData, onError) =>
      subscribeSellerListingOffers(user!.uid, onData, onError),
    enabled: !!user,
  });

  return offers.filter(isListingOfferUnread).length;
}

/** Unread counts keyed by marketplace listing id. */
export function useUnreadOffersByListingId(): Record<string, number> {
  const { user } = useAuth();

  const { data: offers = [] } = useFirestoreLiveQuery({
    queryKey: ["seller-listing-offers", user?.uid],
    queryFn: () => fetchSellerListingOffers(user!.uid),
    subscribe: (onData, onError) =>
      subscribeSellerListingOffers(user!.uid, onData, onError),
    enabled: !!user,
  });

  const counts: Record<string, number> = {};
  for (const o of offers as ListingOffer[]) {
    if (!isListingOfferUnread(o)) continue;
    counts[o.listingId] = (counts[o.listingId] ?? 0) + 1;
  }
  return counts;
}
