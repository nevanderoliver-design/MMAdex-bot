export type RarityId = "mythic" | "legendary" | "epic" | "rare";

export interface FighterCard {
  id: string;
  name: string;
  nickname?: string;
  division: string;
  rarity: RarityId;
  power: number;
  ownerId: string;
  caughtAt: number;
}

export type PackType = "common" | "rare" | "daily" | "weekly";

export interface PackOdds {
  rarity: RarityId;
  chance: number;
}

export interface PackDef {
  id: PackType;
  label: string;
  emoji: string;
  price: number; // 0 = not purchasable
  buyable: boolean;
  odds: PackOdds[];
}

export interface UserProfile {
  coins: number;
  caught: number;
  bestPower: number;
  bestId?: string;
  createdAt: number;
  packs: Record<PackType, number>;
  lastDailyPackAt?: number;
  lastWeeklyPackAt?: number;
}

/** A single active (unclaimed) spawn. Multiple may be active at once. */
export interface ActiveSpawn {
  fighter: FighterCard;
  messageId: string;
  channelId: string;
  spawnedAt: number;
}

export interface GuildConfig {
  channelId?: string;
  intervalMinutes: number;
  enabled: boolean;
  activeSpawns: ActiveSpawn[];
  lastSpawnAt?: number;
  spawnCount: number;
}

export interface MarketListing {
  id: string;
  fighterId: string;
  sellerId: string;
  price: number;
  listedAt: number;
}

export type TradeStatus = "pending" | "completed" | "declined" | "cancelled";

export interface TradeProposal {
  id: string;
  offererId: string;
  targetId: string;
  offerFighterId?: string;
  offerCoins: number;
  wantFighterId?: string;
  status: TradeStatus;
  createdAt: number;
  channelId: string;
  messageId?: string;
}

export interface RarityDef {
  id: RarityId;
  label: string;
  color: number;
  emoji: string;
  catchReward: number;
}

/** A fighter definition from the static database (before a card is minted). */
export interface FighterDef {
  name: string;
  nickname?: string;
  division: string;
  rarity: RarityId;
  power: number;
}