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

// 订阅状态信息（不包含 credits）
export interface SubscriptionStatus {
  planName: string;
  nextResetDate: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  status: string | null;
}

// 用户信息（包含 credits 和订阅信息）
export interface UserInfo {
  planName: string;
  credits: number;
  period: 'daily'; // 免费次数重置周期
  nextResetDate: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  status: string | null;
  dailyFreeTriesRemaining?: number; // 当天剩余免费次数
}