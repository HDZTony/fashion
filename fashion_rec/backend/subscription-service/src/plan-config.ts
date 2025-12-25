/**
 * 套餐配置模块
 * 解耦套餐信息，方便移植到其他项目
 * 
 * 使用方式：
 * 1. 修改此文件中的套餐配置
 * 2. 所有套餐相关的逻辑会自动使用新的配置
 */

export type PlanType = 'free' | 'premium' | 'premium_plus' | 'premium_pro';

export interface PlanConfig {
  /** 套餐类型标识 */
  type: PlanType;
  /** 套餐显示名称 */
  name: string;
  /** 套餐价格（美元） */
  price: number;
  /** 每月试穿次数 */
  monthlyTries: number;
  /** 重置周期（天） */
  resetPeriodDays: number;
  /** 每天免费次数（不计入总次数） */
  dailyFreeTries: number;
}

/**
 * 套餐配置
 * 修改此配置即可调整所有套餐信息
 */
export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  free: {
    type: 'free',
    name: 'Free',
    price: 0,
    monthlyTries: 3, // 每天3次免费
    resetPeriodDays: 1, // 每天重置
    dailyFreeTries: 3, // 每天前3次免费
  },
  premium: {
    type: 'premium',
    name: 'Premium',
    price: 5,
    monthlyTries: 30,
    resetPeriodDays: 30, // 每月重置
    dailyFreeTries: 3, // 每天前3次不计入次数
  },
  premium_plus: {
    type: 'premium_plus',
    name: 'Premium Plus',
    price: 15,
    monthlyTries: 100,
    resetPeriodDays: 30, // 每月重置
    dailyFreeTries: 3, // 每天前3次不计入次数
  },
  premium_pro: {
    type: 'premium_pro',
    name: 'Premium Pro',
    price: 29.9,
    monthlyTries: 250,
    resetPeriodDays: 30, // 每月重置
    dailyFreeTries: 3, // 每天前3次不计入次数
  },
};

/**
 * 根据套餐类型获取配置
 */
export function getPlanConfig(plan: PlanType): PlanConfig {
  return PLAN_CONFIGS[plan];
}

/**
 * 获取所有套餐配置
 */
export function getAllPlanConfigs(): PlanConfig[] {
  return Object.values(PLAN_CONFIGS);
}

/**
 * 根据产品ID获取套餐类型
 * 此函数需要根据实际的产品ID映射关系进行配置
 */
export function getPlanTypeFromProductId(
  productId: string | undefined,
  isTestMode: boolean,
  env: {
    CREEM_TEST_PRODUCT_ID?: string;
    CREEM_PROD_PRODUCT_ID?: string;
    CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS?: string;
    CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS?: string;
    CREEM_TEST_PRODUCT_ID_PREMIUM_PRO?: string;
    CREEM_PROD_PRODUCT_ID_PREMIUM_PRO?: string;
  }
): PlanType {
  if (!productId) {
    return 'free';
  }

  // Premium Pro 产品ID
  const premiumProIds = [
    isTestMode ? env.CREEM_TEST_PRODUCT_ID_PREMIUM_PRO : env.CREEM_PROD_PRODUCT_ID_PREMIUM_PRO,
    env.CREEM_TEST_PRODUCT_ID_PREMIUM_PRO,
    env.CREEM_PROD_PRODUCT_ID_PREMIUM_PRO,
  ].filter(Boolean);

  if (premiumProIds.includes(productId)) {
    return 'premium_pro';
  }

  // Premium Plus 产品ID
  const premiumPlusIds = [
    isTestMode ? env.CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS : env.CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS,
    env.CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS,
    env.CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS,
  ].filter(Boolean);

  if (premiumPlusIds.includes(productId)) {
    return 'premium_plus';
  }

  // Premium 产品ID
  const premiumIds = [
    isTestMode ? env.CREEM_TEST_PRODUCT_ID : env.CREEM_PROD_PRODUCT_ID,
    env.CREEM_TEST_PRODUCT_ID,
    env.CREEM_PROD_PRODUCT_ID,
  ].filter(Boolean);

  if (premiumIds.includes(productId)) {
    return 'premium';
  }

  // 默认返回 free
  return 'free';
}

