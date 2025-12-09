export interface ItemFeatures {
  path?: string;
  type: string | string[];
  color: string | string[];
  style?: string | string[];
  pattern?: string | string[];
  occasion?: string | string[];
  material?: string | string[];
}

export interface Item {
  id?: string | number;
  url?: string;
  features: ItemFeatures;
  filename?: string;
  user_id?: string;
}

export interface PendingItem extends Item {
  selected?: boolean;
}

export interface Recommendation {
  id: string | number;
  path?: string;
  type: string;
  color: string;
  reason: string;
  score: number;
}

export interface AgentOutfitItem {
  wardrobe_id?: string | null;
  role: string;
  description: string;
}

export interface AgentOutfit {
  title: string;
  items: AgentOutfitItem[];
  reason: string;
  long_text: string;
}