/**
 * 套餐配置模块
 * 仅保留产品ID到计划类型的映射
 * 所有产品信息（名称、价格等）都从 Creem API 获取
 */

export type PlanType = 'member';

/**
 * 根据计划类型获取显示名称
 * 注意：实际产品信息应从 Creem API 获取，此函数仅用于业务逻辑中的默认值
 */
export function getPlanName(plan: PlanType): string {
  const nameMap: Record<PlanType, string> = {
    member: 'Member',
  };
  return nameMap[plan] || plan;
}

/**
 * 产品ID到套餐类型的直接映射配置
 * 直接使用产品ID映射到套餐类型，避免依赖产品名称
 * 
 * 包含测试和生产环境的所有产品ID
 */
export const PRODUCT_ID_TO_PLAN_TYPE: Record<string, PlanType> = {
  // 测试环境产品ID
  'prod_1W4roSJevbLIRwQyb3a8SQ': 'member',
  // 生产环境产品ID
  'prod_4cVNXwHwb0RWl62USRMmuJ': 'member',
};


/**
 * 根据产品ID获取套餐类型
 * 直接通过产品ID映射表查找，无需调用API
 */
export function getPlanTypeFromProductId(
  productId: string | undefined
): PlanType {
  if (!productId) {
    throw new Error('productId is required to determine plan type');
  }

  // 直接从映射表查找
  const planType = PRODUCT_ID_TO_PLAN_TYPE[productId];
  
  if (!planType) {
    throw new Error(
      `No plan type found for productId: ${productId}. ` +
      `Available product IDs: ${Object.keys(PRODUCT_ID_TO_PLAN_TYPE).join(', ')}.`
    );
  }
  
  return planType;
}

