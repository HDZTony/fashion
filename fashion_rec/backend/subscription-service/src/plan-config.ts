/**
 * 套餐配置模块
 * 解耦套餐信息，方便移植到其他项目
 * 
 * 使用方式：
 * 1. 修改此文件中的套餐配置
 * 2. 所有套餐相关的逻辑会自动使用新的配置
 */

export type PlanType = 'member';

export interface PlanConfig {
  /** 套餐类型标识 */
  type: PlanType;
  /** 套餐显示名称 */
  name: string;
  /** 套餐价格（美元） */
  price: number;
}

/**
 * 套餐配置
 * 修改此配置即可调整所有套餐信息
 */
export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  member: {
    type: 'member',
    name: 'Member',
    price: 4.9,
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
 * 产品名称到套餐类型的映射配置
 * 这个映射用于将 Creem API 中的产品名称映射到我们的套餐类型
 * 注意：Creem 产品名称可能与 plan.name 不同
 */
export const PRODUCT_NAME_TO_PLAN_TYPE: Record<string, PlanType> = {
  'Fashion Rec Member': 'member',
};

/**
 * 产品ID缓存结构
 */
interface ProductIdCache {
  productIdToPlanType: Record<string, PlanType>;
  cachedAt: number;
  isTestMode: boolean;
}

/**
 * 内存缓存（模块级变量）
 * 注意：在 Cloudflare Workers 环境中，每个请求可能在不同的实例上运行，缓存是请求级别的
 */
let productIdCache: ProductIdCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

/**
 * 根据产品ID获取套餐类型
 * 通过 Creem API 动态获取产品列表，根据产品名称匹配产品ID
 */
export async function getPlanTypeFromProductId(
  productId: string | undefined,
  isTestMode: boolean,
  creem: {
    products: {
      list: (params?: { page?: number; limit?: number }) => Promise<{
        items: Array<{
          id: string;
          name: string;
          billingType: 'recurring' | 'onetime';
        }>;
        pagination: any;
      }>;
    };
  }
): Promise<PlanType> {
  if (!productId) {
    throw new Error('productId is required to determine plan type');
  }

  // 检查缓存是否有效
  const now = Date.now();
  if (
    productIdCache &&
    productIdCache.isTestMode === isTestMode &&
    now - productIdCache.cachedAt < CACHE_TTL_MS &&
    productIdCache.productIdToPlanType[productId]
  ) {
    return productIdCache.productIdToPlanType[productId];
  }

  try {
    // 调用 API 获取产品列表
    const productsResponse = await creem.products.list({
      page: 1,
      limit: 100, // 获取足够多的产品
    });

    const products = productsResponse.items || [];
    
    // 构建产品ID到套餐类型的映射（只处理 recurring 类型的产品）
    const productIdToPlanType: Record<string, PlanType> = {};
    
    for (const product of products) {
      // 只匹配订阅类型（recurring）的产品
      if (product.billingType === 'recurring') {
        const planType = PRODUCT_NAME_TO_PLAN_TYPE[product.name];
        if (planType) {
          productIdToPlanType[product.id] = planType;
        }
      }
    }

    // 更新缓存
    productIdCache = {
      productIdToPlanType,
      cachedAt: now,
      isTestMode,
    };

    // 返回匹配的套餐类型，如果没有匹配则抛出错误
    if (!productIdToPlanType[productId]) {
      throw new Error(`No plan type found for productId: ${productId}`);
    }
    return productIdToPlanType[productId];
  } catch (error: any) {
    console.error('❌ Error fetching products from Creem API:', error);
    // 如果 API 调用失败，尝试使用缓存（即使过期）
    if (productIdCache && productIdCache.productIdToPlanType[productId]) {
      console.warn('⚠️ Using expired cache due to API error');
      return productIdCache.productIdToPlanType[productId];
    }
    // 如果缓存也没有，重新抛出错误
    throw new Error(`Failed to determine plan type for productId: ${productId}. Original error: ${error.message}`);
  }
}

