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
 * 产品ID到套餐类型的直接映射配置
 * 直接使用产品ID映射到套餐类型，避免依赖产品名称
 * 
 * 包含测试和生产环境的所有产品ID
 */
export const PRODUCT_ID_TO_PLAN_TYPE: Record<string, PlanType> = {
  // 测试环境产品ID
  'prod_1W4roSJevbLIRwQyb3a8SQ': 'member',
  // 生产环境产品ID
  'prod_ZcR2OsakU427r5LppdXpe': 'member',
};


/**
 * 根据产品ID获取套餐类型
 * 直接通过产品ID映射表查找，无需调用API
 */
export function getPlanTypeFromProductId(
  productId: string | undefined
): PlanType {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'plan-config.ts:65',message:'getPlanTypeFromProductId called',data:{productId,productIdType:typeof productId,productIdLength:productId?.length,hasMapping:!!PRODUCT_ID_TO_PLAN_TYPE,availableIds:Object.keys(PRODUCT_ID_TO_PLAN_TYPE)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})}).catch(()=>{});
  // #endregion
  
  if (!productId) {
    throw new Error('productId is required to determine plan type');
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'plan-config.ts:72',message:'Before mapping lookup',data:{productId,productIdJSON:JSON.stringify(productId),mappingKeys:Object.keys(PRODUCT_ID_TO_PLAN_TYPE),mappingValues:Object.values(PRODUCT_ID_TO_PLAN_TYPE),directLookup:PRODUCT_ID_TO_PLAN_TYPE[productId]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,D'})}).catch(()=>{});
  // #endregion

  // 直接从映射表查找
  const planType = PRODUCT_ID_TO_PLAN_TYPE[productId];
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'plan-config.ts:75',message:'After mapping lookup',data:{productId,planType,found:!!planType,allMappings:PRODUCT_ID_TO_PLAN_TYPE},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  
  if (!planType) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'plan-config.ts:78',message:'Mapping not found - throwing error',data:{productId,availableIds:Object.keys(PRODUCT_ID_TO_PLAN_TYPE),productIdCharCodes:productId.split('').map(c=>c.charCodeAt(0)),expectedCharCodes:'prod_ZcR2OsakU427r5LppdXpe'.split('').map(c=>c.charCodeAt(0))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    throw new Error(
      `No plan type found for productId: ${productId}. ` +
      `Available product IDs: ${Object.keys(PRODUCT_ID_TO_PLAN_TYPE).join(', ')}`
    );
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'plan-config.ts:85',message:'Returning plan type',data:{productId,planType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  return planType;
}

