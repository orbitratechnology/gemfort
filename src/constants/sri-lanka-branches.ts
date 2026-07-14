/**
 * Sri Lankan bank branches, keyed by bank code.
 * Source: https://github.com/samma89/Sri-Lanka-Bank-and-Branch-List (branches.json)
 */

import branchesByBank from '@/constants/data/sri-lanka-branches.json';

export type SriLankaBranch = {
  bankID: number;
  ID: number;
  name: string;
};

type BranchMap = Record<string, SriLankaBranch[]>;

const BRANCHES = branchesByBank as BranchMap;

export function getBranchesForBank(bankCode: string | null | undefined): SriLankaBranch[] {
  if (!bankCode) return [];
  const list = BRANCHES[bankCode];
  if (!list?.length) return [];
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

export function getBranchById(
  bankCode: string | null | undefined,
  branchId: number | null | undefined,
): SriLankaBranch | undefined {
  if (!bankCode || branchId == null) return undefined;
  return getBranchesForBank(bankCode).find((b) => b.ID === branchId);
}

export function findBranchByName(
  bankCode: string | null | undefined,
  name: string | null | undefined,
): SriLankaBranch | undefined {
  if (!bankCode || !name?.trim()) return undefined;
  const q = name.trim().toLowerCase();
  return getBranchesForBank(bankCode).find((b) => b.name.toLowerCase() === q);
}

export function filterBranches(
  bankCode: string | null | undefined,
  query: string,
): SriLankaBranch[] {
  const all = getBranchesForBank(bankCode);
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (b) => b.name.toLowerCase().includes(q) || String(b.ID).includes(q),
  );
}

export function bankHasBranches(bankCode: string | null | undefined): boolean {
  return getBranchesForBank(bankCode).length > 0;
}
