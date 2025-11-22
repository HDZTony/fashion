export interface ItemFeatures {
  path?: string;
  type: string;
  color: string;
  style?: string;
}

export interface Item {
  id: string | number;
  url?: string;
  features: ItemFeatures;
}

export interface Recommendation {
  id: string | number;
  path?: string;
  type: string;
  color: string;
  reason: string;
  score: number;
}
