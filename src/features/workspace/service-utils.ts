import type { ServiceRecord } from '@/types';

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
