import type { GemStoneStage, ServiceRecord } from '@/types';

export function groupServicesByType(services: ServiceRecord[]): Record<string, ServiceRecord[]> {
  return services.reduce<Record<string, ServiceRecord[]>>((acc, service) => {
    const key = service.serviceType;
    acc[key] = acc[key] ?? [];
    acc[key].push(service);
    return acc;
  }, {});
}

export function sortServiceGroups(
  grouped: Record<string, ServiceRecord[]>,
): { type: string; services: ServiceRecord[] }[] {
  return Object.entries(grouped)
    .map(([type, list]) => ({
      type,
      services: list.sort((a, b) => b.dateGiven.toMillis() - a.dateGiven.toMillis()),
    }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

export type RepeatableServiceType = 'cutting' | 'heating' | 'polishing';

const REPEAT_SERVICE_TYPE: Record<RepeatableServiceType, string> = {
  cutting: 'recutting',
  heating: 'reheating',
  polishing: 'repolishing',
};

const STAGE_AFTER_SERVICE: Record<RepeatableServiceType, GemStoneStage> = {
  cutting: 'cut',
  heating: 'heated',
  polishing: 'polished',
};

/** First-time vs repeat pass (e.g. cutting → recutting) for a stone's current stage. */
export function suggestedServiceType(
  type: RepeatableServiceType,
  stoneStage: GemStoneStage | null | undefined,
): string {
  return stoneStage === STAGE_AFTER_SERVICE[type] ? REPEAT_SERVICE_TYPE[type] : type;
}

export function repeatServiceType(type: RepeatableServiceType): string {
  return REPEAT_SERVICE_TYPE[type];
}
