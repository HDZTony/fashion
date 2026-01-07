import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createCreem } from 'creem_io';
import { createClient } from '@supabase/supabase-js';
import { SubscriptionService } from './subscription-service';
import { getPlanTypeFromProductId, PlanType, getAllPlanConfigs, PRODUCT_ID_TO_PLAN_TYPE } from './plan-config';

// Define environment variables interface for Cloudflare Workers
interface Env {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  CREEM_TEST_MODE?: string;
  CREEM_TEST_API_KEY?: string;
  CREEM_PROD_API_KEY?: string;
  CREEM_TEST_WEBHOOK_SECRET?: string;
  CREEM_PROD_WEBHOOK_SECRET?: string;
  NODE_ENV?: string;
}

// Create Hono app with environment bindings
const app = new Hono<{ Bindings: Env }>();

// Helper function to get Creem client and subscription service from env
function getServices(c: { env: Env }) {
  const SUPABASE_URL = c.env.SUPABASE_URL?.trim();
  const SUPABASE_KEY = c.env.SUPABASE_KEY?.trim();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
  }

  // 验证 URL 格式
  if (!SUPABASE_URL.startsWith('http://') && !SUPABASE_URL.startsWith('https://')) {
    throw new Error(`Invalid SUPABASE_URL format: "${SUPABASE_URL}". Must start with http:// or https://`);
  }

  try {
    const subscriptionService = new SubscriptionService(SUPABASE_URL, SUPABASE_KEY);

    const isTestMode = c.env.CREEM_TEST_MODE === 'true';
    const creemApiKey = isTestMode 
      ? c.env.CREEM_TEST_API_KEY 
      : c.env.CREEM_PROD_API_KEY;

    if (!creemApiKey) {
      throw new Error(`❌ ${isTestMode ? '测试' : '生产'}环境 API Key 未配置`);
    }

    // Test模式下的配置检查
    if (isTestMode) {
      const expectedTestApiKey = 'creem_test_4WsdDJBIaJR4UcGoGkBPMb';
      const expectedTestWebhookUrl = 'https://fashion.hdz73.com/test-webhook';
      
      if (creemApiKey !== expectedTestApiKey) {
        console.error(`❌ Test模式API Key不匹配！`);
        console.error(`   当前值: ${creemApiKey}`);
        console.error(`   期望值: ${expectedTestApiKey}`);
        console.error(`   Webhook URL 应该配置为: ${expectedTestWebhookUrl}`);
        throw new Error(`Test模式API Key配置错误：期望 ${expectedTestApiKey}，但当前为 ${creemApiKey}`);
      }
      // 验证通过，静默处理（避免每次请求都打印日志）
    }

    const creemWebhookSecret = isTestMode
      ? c.env.CREEM_TEST_WEBHOOK_SECRET
      : c.env.CREEM_PROD_WEBHOOK_SECRET;

    const creem = createCreem({
      apiKey: creemApiKey,
      webhookSecret: creemWebhookSecret,
      testMode: isTestMode,
    });

    return { subscriptionService, creem, isTestMode, creemApiKey, creemWebhookSecret, env: c.env };
  } catch (error: any) {
    // 提供更详细的错误信息
    if (error.message?.includes('Invalid supabaseUrl') || error.message?.includes('supabaseUrl')) {
      throw new Error(`Invalid SUPABASE_URL: "${SUPABASE_URL}". Error: ${error.message}. Please check your SUPABASE_URL secret value in Cloudflare Workers.`);
    }
    throw error;
  }
}

// Cache for user tokens within a single request (to avoid duplicate calls)
const requestUserCache = new Map<string, { id: string; email?: string } | null>();

/**
 * 直接从 JWT token 解码获取用户信息（不调用 Supabase API）
 * 这比调用 supabase.auth.getUser() 快得多（从12-22秒降低到几毫秒）
 */
function decodeJWTToken(token: string): { id: string; email?: string } | null {
  try {
    // JWT token 格式：header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // 解码 payload（base64url）
    const payload = parts[1];
    if (!payload) {
      return null;
    }
    
    // 添加 padding（如果需要）
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decodedPayload = atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'));
    const payloadObj = JSON.parse(decodedPayload);

    // 从 payload 中提取用户信息
    // Supabase JWT token 通常包含 sub (user id) 和 email
    const userId = payloadObj.sub || payloadObj.user_id || payloadObj.id;
    const email = payloadObj.email;

    if (!userId || typeof userId !== 'string') {
      return null;
    }

    return {
      id: userId,
      email: typeof email === 'string' ? email : undefined,
    };
  } catch (error: any) {
    console.warn('Error decoding JWT token:', error.message);
    return null;
  }
}

/**
 * 从 Authorization header 中解析 JWT token 并获取用户信息
 * 优化：优先直接从 JWT token 解码（快速），失败时才调用 Supabase API（慢速）
 * 返回用户对象，包含 id 和 email
 */
async function getUserFromToken(c: { env: Env; req: any }): Promise<{ id: string; email?: string } | null> {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return null;
    }

    // 使用请求级缓存（基于 token 的前16个字符作为 key）
    // 注意：这不是全局缓存，只是为了避免同一请求中的重复调用
    const cacheKey = `token_${token.substring(0, 16)}`;
    if (requestUserCache.has(cacheKey)) {
      return requestUserCache.get(cacheKey)!;
    }

    // 优化：优先直接从 JWT token 解码（快速，几毫秒）
    // 这避免了慢速的 Supabase API 调用（12-22秒）
    const decodedUser = decodeJWTToken(token);
    if (decodedUser && decodedUser.id) {
      // 缓存结果
      requestUserCache.set(cacheKey, decodedUser);
      
      // 清理缓存（避免内存泄漏，只保留最近100个）
      if (requestUserCache.size > 100) {
        const firstKey = requestUserCache.keys().next().value;
        if (firstKey !== undefined) {
          requestUserCache.delete(firstKey);
        }
      }
      
      return decodedUser;
    }

    // 如果直接解码失败，回退到 Supabase API（慢速，但更可靠）
    console.warn('JWT token decode failed, falling back to Supabase API');
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.warn('Failed to get user from token:', error?.message);
      requestUserCache.set(cacheKey, null);
      return null;
    }

    const result = {
      id: user.id,
      email: user.email,
    };
    
    // 缓存结果（仅用于当前请求）
    requestUserCache.set(cacheKey, result);
    
    // 清理缓存（避免内存泄漏，只保留最近100个）
    if (requestUserCache.size > 100) {
      const firstKey = requestUserCache.keys().next().value;
      if (firstKey) {
        requestUserCache.delete(firstKey as string);
      }
    }
    
    return result;
  } catch (error: any) {
    console.warn('Error parsing token:', error.message);
    return null;
  }
}

/**
 * 从 Authorization header 中解析 JWT token 并获取用户 ID
 * 使用 Supabase SDK 验证 token
 * @deprecated 使用 getUserFromToken 替代，以获取完整的用户信息
 */
async function getUserIdFromToken(c: { env: Env; req: any }): Promise<string | null> {
  const user = await getUserFromToken(c);
  return user?.id || null;
}

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'creem-signature'],
  })
);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'subscription-service' });
});

// Get environment configuration (for frontend)
app.get('/config', async (c) => {
  try {
    const { isTestMode } = getServices(c);
    
    return c.json({
      isTestMode,
      environment: isTestMode ? 'TEST' : 'PRODUCTION',
      message: 'Product IDs are now dynamically fetched from Creem API using product names',
    });
  } catch (error: any) {
    console.error('❌ Config endpoint error:', error);
    return c.json(
      {
        error: 'Failed to get config',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

// Get all subscription plans (for frontend)
// Note: free is not included in the plans list (it's the default state)
app.get('/plans', async (c) => {
  try {
    const { creem, isTestMode } = getServices(c);
    const allPlans = getAllPlanConfigs();
    
    // Format plans for frontend consumption
    // Use product ID mapping based on current environment (test/production)
    const formattedPlans = allPlans.map((plan) => {
      // Find all product IDs that map to this plan type
      const allProductIds = Object.keys(PRODUCT_ID_TO_PLAN_TYPE).filter(
        (productId) => PRODUCT_ID_TO_PLAN_TYPE[productId] === plan.type
      );
      
      // Select the correct product ID based on current environment
      // Test environment product IDs: prod_1W4roSJevbLIRwQyb3a8SQ
      // Production environment product IDs: prod_ZcR2OsakU427r5LppdXpe
      let productId: string | null = null;
      
      if (isTestMode) {
        // Test environment: prefer test product IDs
        productId = allProductIds.find(id => id === 'prod_1W4roSJevbLIRwQyb3a8SQ') || allProductIds[0] || null;
      } else {
        // Production environment: prefer production product IDs
        productId = allProductIds.find(id => id === 'prod_ZcR2OsakU427r5LppdXpe') || allProductIds[0] || null;
      }
      
      // Log the product ID being used (for debugging)
      if (productId) {
        console.log(`✅ Using product ID ${productId} for plan "${plan.name}" (${plan.type}), isTestMode: ${isTestMode}`);
      } else {
        console.warn(`⚠️ No product ID configured for plan "${plan.name}" (${plan.type}). Available mappings:`, 
          Object.entries(PRODUCT_ID_TO_PLAN_TYPE).filter(([_, planType]) => planType === plan.type));
      }
      
      // Format price
      const priceDisplay = `$${plan.price} / mo`;
          
      // Format description
      let desc: string;
      switch (plan.type) {
        case 'member':
          desc = 'Generate 2k try-on images';
          break;
        default:
          desc = '';
      }
      
      return {
        slug: plan.type,
        name: plan.name,
        price: priceDisplay,
        desc,
        productId, // Include productId for checkout/upgrade operations
        // Frontend will set action based on user's current subscription status
      };
    });
    
    return c.json({ plans: formattedPlans });
  } catch (error: any) {
    console.error('❌ Plans endpoint error:', error);
    return c.json(
      {
        error: 'Failed to get plans',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

// Get credits products (onetime products)
app.get('/credits', async (c) => {
  try {
    const { creem } = getServices(c);
    
    // 获取所有产品
    const productsResponse = await creem.products.list({
      page: 1,
      limit: 100,
    });
    
    const products = productsResponse.items || [];
    
    // 过滤出 credits 产品（onetime 类型，名称包含 "Credits"）
    const creditsProducts = products
      .filter((p) => p.billingType === 'onetime' && p.name.includes('Credits'))
      .map((p) => {
        // 从产品名称中提取 credits 数量
        const creditsMatch = p.name.match(/(\d+)\s*Credits?/i);
        const credits = creditsMatch ? parseInt(creditsMatch[1]) : 0;
        
        return {
          id: p.id,
          name: p.name,
          price: (p.price || 0) / 100, // 转换为美元（cents 转换为 dollars）
          credits,
          currency: p.currency || 'USD',
        };
      })
      .sort((a, b) => a.credits - b.credits); // 按 credits 数量排序
    
    return c.json({ credits: creditsProducts });
  } catch (error: any) {
    console.error('❌ Credits endpoint error:', error);
    return c.json(
      {
        error: 'Failed to get credits products',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

// Diagnostic endpoint for database connection
app.get('/diagnostics/db', async (c) => {
  try {
    const { subscriptionService } = getServices(c);
    const diagnostics: any = {
      supabaseUrl: c.env.SUPABASE_URL ? 'Set' : 'Not set',
      supabaseKey: c.env.SUPABASE_KEY ? 'Set' : 'Not set',
      tableName: 'user_subscriptions',
    };

    // Test database connection
    try {
      const testUserId = 'test-connection-check';
      const { data, error } = await subscriptionService['table']
        .select('*')
        .limit(1);
      
      if (error) {
        diagnostics.dbConnection = {
          status: 'failed',
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        };
      } else {
        diagnostics.dbConnection = {
          status: 'success',
          canQuery: true,
        };
      }
    } catch (dbError: any) {
      diagnostics.dbConnection = {
        status: 'error',
        error: dbError.message,
      };
    }

    return c.json(diagnostics);
  } catch (error: any) {
    return c.json(
      {
        error: 'Diagnostics failed',
        message: error.message,
      },
      500
    );
  }
});

// Diagnostic endpoint for debugging Creem API connection
app.get('/diagnostics', async (c) => {
  try {
    const { creem, isTestMode, creemApiKey, creemWebhookSecret } = getServices(c);
    const diagnostics: any = {
      environment: isTestMode ? 'TEST' : 'PRODUCTION',
      apiKey: {
        set: !!creemApiKey,
        prefix: creemApiKey?.substring(0, 15) || 'Not set',
        length: creemApiKey?.length || 0,
        source: isTestMode ? 'CREEM_TEST_API_KEY' : 'CREEM_PROD_API_KEY',
      },
      testMode: isTestMode,
      webhookSecret: {
        set: !!creemWebhookSecret,
        source: isTestMode ? 'CREEM_TEST_WEBHOOK_SECRET' : 'CREEM_PROD_WEBHOOK_SECRET',
      },
    };

    // Test API connection by listing products
    try {
      const productsResponse = await creem.products.list();
      // ProductList 包含 items 数组和 pagination 信息
      const products = productsResponse.items || [];
      
      diagnostics.apiConnection = {
        status: 'success',
        productsCount: products.length,
        products: products.slice(0, 5).map((p) => ({
              id: p.id,
              name: p.name,
            })),
        rawResponseType: typeof productsResponse,
        rawResponseKeys: productsResponse ? Object.keys(productsResponse) : [],
      };
    } catch (apiError: any) {
      diagnostics.apiConnection = {
        status: 'failed',
        error: apiError.message,
        statusCode: apiError.status || apiError.statusCode,
      };
    }

    return c.json(diagnostics);
  } catch (error: any) {
    return c.json(
      {
        error: 'Diagnostics failed',
        message: error.message,
      },
      500
    );
  }
});

// ==================== Subscription Management Routes ====================

/**
 * GET /userinfo
 * 获取用户订阅状态和试穿次数信息
 * 使用 Creem SDK 通过邮箱 -> 客户ID -> 交易列表 -> 订阅ID -> 订阅信息的流程获取订阅
 * 需要 user_id 查询参数或从 Authorization header 解析
 */
app.get('/userinfo', async (c) => {
  console.log('[Subscription Service] /userinfo endpoint called', { query: c.req.query() });
  try {
    const { subscriptionService, creem, isTestMode, env } = getServices(c);
    // 优先从查询参数获取 user_id
    let userId = c.req.query('user_id');
    let user: { id: string; email?: string } | null = null;

    // 如果没有查询参数，尝试从 Authorization header 解析
    if (!userId) {
      user = await getUserFromToken(c);
      if (user) {
        userId = user.id;
      }
    } else {
      // 即使有 user_id，也尝试获取 user 对象以获取 email（避免重复调用）
      user = await getUserFromToken(c);
    }

    if (!userId) {
      return c.json({ error: 'User ID is required (use ?user_id=xxx or Authorization header)' }, 400);
    }

    // 获取用户邮箱（优先使用已获取的 user 对象，避免重复调用）
    let userEmail: string | undefined;
    if (user?.email) {
      userEmail = user.email;
    } else {
      // 如果无法从 token 获取邮箱，尝试从数据库获取
      // 注意：这里假设数据库中有邮箱字段，如果没有，需要从 Supabase auth 表获取
      // 暂时先使用 token 解析的方式
      const { data: subscriptionData } = await subscriptionService['table']
        .select('*')
        .eq('user_id', userId)
        .single();
    }

    if (!userEmail) {
      console.log(`No email found for user ${userId}, returning free account status`);
      const status = await subscriptionService.getSubscriptionStatus(userId);
      return c.json(status);
    }

    // 步骤1: 通过邮箱获取客户ID
    const customerByEmail = await creem.customers.get({
      email: userEmail,
    });

    if (!customerByEmail || !customerByEmail.id) {
      return c.json(
        {
          error: 'Customer not found',
          message: `No Creem customer found for email ${userEmail}`,
        },
        404
      );
    }

    const customerId = customerByEmail.id;

    // 优化：先检查数据库是否已有 subscriptionId，避免调用慢速的 transactions.list API
    let subscriptionId: string | null = null;
    // 优化：查询完整数据，避免后续步骤重复查询（节省7-8秒）
    const { data: existingSubscriptionData, error: dbError } = await subscriptionService['table']
      .select('*')
      .eq('user_id', userId)
      .single();
    
    // 如果数据库中有 subscriptionId 且 customerId 匹配，直接使用
    if (existingSubscriptionData?.creem_subscription_id && 
        existingSubscriptionData?.creem_customer_id === customerId) {
      subscriptionId = existingSubscriptionData.creem_subscription_id;
      console.log(`Using cached subscriptionId from database: ${subscriptionId}`);
    } else {
      // 步骤2: 通过客户ID获取交易列表（仅在数据库中没有 subscriptionId 时调用）
      const transactionsResponse = await creem.transactions.list({
        customerId: customerId,
      });

      // TransactionList 包含 items 数组和 pagination 信息
      const transactions = transactionsResponse.items || [];

      if (!transactions || transactions.length === 0) {
        return c.json(
          {
            error: 'No transactions found',
            message: `No transactions found for customer ${customerId}`,
          },
          404
        );
      }

      // 步骤3: 从交易列表中找到第一个有订阅ID的交易
      // Transaction 接口中订阅ID字段是 subscription?: string
      const firstTransactionWithSubscription = transactions.find(t => t.subscription);
      
      if (!firstTransactionWithSubscription || !firstTransactionWithSubscription.subscription) {
        console.log(`No subscription ID found in transactions for customer ${customerId}`);
        const status = await subscriptionService.getSubscriptionStatus(userId);
        return c.json(status);
      }

      subscriptionId = firstTransactionWithSubscription.subscription;
    }

    if (!subscriptionId) {
      const status = await subscriptionService.getSubscriptionStatus(userId);
      return c.json(status);
    }

    // 步骤4: 使用订阅ID获取订阅信息
    // TypeScript 会自动推断类型为 Subscription（来自 creem_io SDK）
    const subscription = await creem.subscriptions.get({
      subscriptionId,
    });

    // 从 Creem API 返回的数据中提取信息（使用正确的类型定义）
    const creemStatus = subscription.status;
    
    // 获取产品ID：只使用 subscription.product.id（当前订阅的产品）
    const productId = getProductIdFromSubscription(subscription);
    
    if (!productId) {
      console.error('No product ID found in Creem subscription response', {
        hasItems: !!subscription.items,
        itemsLength: subscription.items?.length,
        productType: typeof subscription.product,
        product: subscription.product,
      });
      return c.json(
        {
          error: 'Invalid subscription data',
          message: 'Subscription does not contain product information',
        },
        500
      );
    }
    
    // 获取 period_end（使用类型定义中的 currentPeriodEndDate）
    const periodEnd = toISOString(subscription.currentPeriodEndDate);
    
    // 获取 last_transaction_id（用于判断是否是新交易）
    const lastTransactionId = subscription.lastTransactionId || null;

    // 先从数据库获取现有订阅记录（用于优化：如果订阅ID匹配，可以跳过API调用）
    const { data: subscriptionData } = await subscriptionService['table']
      .select('*')
      .eq('user_id', userId)
      .single();

    // 根据产品ID确定计划类型（优化：如果订阅ID匹配，使用数据库中的plan）
    let plan: PlanType;
    if (subscriptionData?.plan && subscriptionData?.creem_subscription_id === subscriptionId) {
      // 数据库中有记录且订阅ID匹配，直接使用数据库中的plan（快速路径，避免API调用）
      plan = subscriptionData.plan as PlanType;
      console.log(`Using cached plan from database: ${plan} for subscriptionId: ${subscriptionId}`);
    } else {
      // 需要调用API确定plan类型（订阅ID不匹配或数据库中没有记录）
      plan = getPlanFromProductId(productId);
    }

    // 如果计划类型、状态或周期结束时间发生变化，更新数据库
    if (!subscriptionData || 
        plan !== subscriptionData.plan || 
        creemStatus !== subscriptionData.status || 
        periodEnd !== subscriptionData.period_end ||
        subscriptionId !== subscriptionData.subscription_id) {
      console.log(`Updating subscription in database: plan=${plan}, status=${creemStatus}, periodEnd=${periodEnd}, lastTransactionId=${lastTransactionId}`);
      // 不再映射，直接存 Creem 原始状态（业务逻辑仍按 canceled/expired 分支处理）
      const dbStatus = creemStatus || 'active';
      await subscriptionService.updateSubscription(
        userId,
        plan,
        subscriptionId,
        customerId,
        dbStatus,
        periodEnd,
        lastTransactionId
      );
    } else {
      console.log(`Skipping database update: no changes detected for user ${userId}`);
    }

    // 获取更新后的数据库状态（包含试穿次数等信息）
    // 优化：如果 existingSubscriptionData 存在，直接使用，避免重复查询数据库
    const status = await subscriptionService.getSubscriptionStatus(userId, existingSubscriptionData);
    
    // 使用 Creem API 返回的状态覆盖数据库状态（确保状态准确）
    return c.json({
      ...status,
      status: creemStatus,
      subscriptionId: subscriptionId,
      customerId: customerId,
      // 如果 Creem API 返回的 period_end 与数据库不同，使用 Creem 的值
      nextResetDate: periodEnd ? new Date(periodEnd).toISOString() : status.nextResetDate,
    });
  } catch (error: any) {
    console.error('Error getting subscription status:', error);
    return c.json(
      {
        error: 'Failed to get subscription status',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /subscription/check-try
 * 检查并消耗一次试穿次数
 */
app.post('/subscription/check-try', async (c) => {
  try {
    const { subscriptionService } = getServices(c);
    const body = await c.req.json();
    const userId = body.user_id;

    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400);
    }

    const result = await subscriptionService.checkAndConsumeTry(userId);
    
    if (!result.success) {
      return c.json({ error: result.message }, 403);
    }

    return c.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error('Error checking try:', error);
    return c.json(
      {
        error: 'Failed to check try',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /subscription/update
 * 更新订阅状态（由 webhook 调用或手动调用）
 */
app.post('/subscription/update', async (c) => {
  try {
    const { subscriptionService } = getServices(c);
    const body = await c.req.json();
    const { user_id, plan, creem_subscription_id, creem_customer_id, status } = body;

    console.log('🔄 Manual subscription update request:', {
      user_id,
      plan,
      creem_subscription_id,
      creem_customer_id,
      status,
    });

    if (!user_id || !plan) {
      return c.json({ error: 'user_id and plan are required' }, 400);
    }

    await subscriptionService.updateSubscription(
      user_id,
      plan,
      creem_subscription_id,
      creem_customer_id,
      status || 'active'
    );

    console.log(`✅ Subscription updated successfully for user: ${user_id}`);
    
    // 返回更新后的订阅状态
    const updatedStatus = await subscriptionService.getSubscriptionStatus(user_id);
    return c.json({ 
      message: 'Subscription updated successfully',
      subscription: updatedStatus,
    });
  } catch (error: any) {
    console.error('❌ Error updating subscription:', error);
    return c.json(
      {
        error: 'Failed to update subscription',
        message: error.message || 'Unknown error',
        details: c.env.NODE_ENV === 'development' ? {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        } : undefined,
      },
      500
    );
  }
});

// ==================== Helper Functions ====================

/**
 * 从订阅对象中获取产品ID
 * 只使用 subscription.product.id（当前订阅的产品）
 */
function getProductIdFromSubscription(subscription: { product?: any }): string | undefined {
  if (typeof subscription.product === 'string') {
    return subscription.product;
  } else if (subscription.product && typeof subscription.product === 'object' && 'id' in subscription.product) {
    return subscription.product.id;
  }
  return undefined;
}

/**
 * 安全地将日期转换为 ISO 字符串
 * 处理 Date 对象、字符串或时间戳
 */
function toISOString(date: Date | string | number | null | undefined): string | null {
  if (!date) return null;
  
  if (date instanceof Date) {
    return date.toISOString();
  }
  
  if (typeof date === 'string') {
    // 如果已经是 ISO 字符串，直接返回
    if (date.includes('T') && date.includes('Z')) {
      return date;
    }
    // 尝试解析字符串
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return date; // 如果无法解析，返回原字符串
  }
  
  if (typeof date === 'number') {
    // 时间戳（可能是秒或毫秒）
    const timestamp = date < 10000000000 ? date * 1000 : date;
    return new Date(timestamp).toISOString();
  }
  
  return null;
}

/**
 * 根据产品ID确定套餐类型
 * 使用配置模块中的函数，通过产品ID直接映射
 */
function getPlanFromProductId(
  productId: string | undefined
): PlanType {
  return getPlanTypeFromProductId(productId);
}

// ==================== Webhook Routes ====================

/**
 * 处理订阅事件的共享函数
 */
async function handleSubscriptionEvent(
  data: any,
  subscriptionService: SubscriptionService,
  creem: ReturnType<typeof createCreem>,
  isTestMode: boolean,
  targetStatus: 'active' | 'canceled'
) {
  // 根据官方文档，事件格式为：{ id, eventType, object, created_at, mode }
  // 优先使用 object 字段（官方标准格式）
  const eventObject = data.object || data.subscription || data;
  
  // 尝试多种方式获取 subscriptionId（优先使用官方标准格式）
  const subscriptionId = eventObject.id || data.subscription?.id || data.id;
  
  if (!subscriptionId) {
    console.error('❌ No subscription ID found in subscription event');
    console.error('📋 Event data structure:', {
      hasObject: !!data.object,
      hasSubscription: !!data.subscription,
      eventType: data.eventType || data.type,
      keys: Object.keys(data),
    });
    return;
  }

  // 尝试多种方式获取 userId（优先使用官方标准格式中的 metadata）
  // 根据官方文档，metadata 可能在 object.metadata 或 checkout.metadata
  let userId = 
    eventObject.metadata?.userId ||
    eventObject.metadata?.user_id ||
    data.checkout?.metadata?.userId || 
    data.checkout?.metadata?.user_id ||
    data.metadata?.userId || 
    data.metadata?.user_id ||
    data.subscription?.metadata?.userId ||
    data.subscription?.metadata?.user_id;
  
  // 如果 metadata 中没有 userId，从数据库查找
  if (!userId) {
    console.log('🔍 userId not found in metadata, querying database...');
    
    // 先尝试通过 subscriptionId 查找
    try {
      const { data: subscriptionData, error: queryError } = await subscriptionService['table']
        .select('user_id')
        .eq('creem_subscription_id', subscriptionId)
        .single();

      if (!queryError && subscriptionData?.user_id) {
        userId = subscriptionData.user_id;
        console.log(`✅ Found userId ${userId} for subscription ${subscriptionId} in database`);
      }
    } catch (dbError: any) {
      console.warn('⚠️ Error querying database by subscriptionId:', dbError.message);
    }

    // 如果通过 subscriptionId 找不到，尝试通过 customerId 查找
    if (!userId) {
      // 优先使用官方标准格式中的 customer
      const customerId = eventObject.customer?.id || data.customer?.id || data.subscription?.customer?.id;
      if (customerId) {
        console.log(`🔍 Trying to find userId by customerId: ${customerId}`);
        try {
          const { data: customerData, error: customerError } = await subscriptionService['table']
            .select('user_id')
            .eq('creem_customer_id', customerId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

          if (!customerError && customerData?.user_id) {
            userId = customerData.user_id;
            console.log(`✅ Found userId ${userId} for customerId ${customerId} in database`);
          }
        } catch (customerDbError: any) {
          console.warn('⚠️ Error querying database by customerId:', customerDbError.message);
        }
      }
    }

    // 如果还是找不到 userId，记录详细错误信息但不返回，继续处理
    if (!userId) {
      // 优先使用官方标准格式中的 customer
      const customerId = eventObject.customer?.id || data.customer?.id || data.subscription?.customer?.id;
      const customerEmail = eventObject.customer?.email || data.customer?.email || data.subscription?.customer?.email;
      
      console.error('❌ Could not find userId for subscription:', {
        subscriptionId,
        customerId,
        customerEmail,
        metadata: data.subscription?.metadata || data.checkout?.metadata || data.metadata,
        fullData: JSON.stringify(data, null, 2),
      });
      
      // 不直接返回，而是记录错误并继续
      // 这样至少可以记录订阅信息，等待后续通过其他方式（如 sync-from-subscription）同步
      console.warn('⚠️ Subscription event received but cannot update without userId. Subscription details:', {
        subscriptionId,
        customerId,
        customerEmail,
        status: targetStatus,
      });
      
      // 返回，因为无法更新没有 userId 的订阅
      return;
    }
  }

  try {
    // 获取订阅详情以获取产品ID
    const subscription = await creem.subscriptions.get({
      subscriptionId,
    });
    
    // 获取产品ID（优先使用 subscription.product.id）
    let productId = getProductIdFromSubscription(subscription);
    
    // 如果从 subscription 中获取不到，尝试从 eventObject 或 data 中获取
    if (!productId) {
      productId = (eventObject as any)?.product?.id
        || (eventObject as any)?.items?.[0]?.productId
        || (data as any)?.subscription?.items?.[0]?.productId
        || (data as any)?.subscription?.productId;
    }
    
    const plan = getPlanFromProductId(productId);
    
    // 获取 period_end（使用类型定义中的 currentPeriodEndDate）
    const periodEnd = subscription.currentPeriodEndDate 
      ? toISOString(subscription.currentPeriodEndDate)
      : ((eventObject as any)?.current_period_end_date
        || (eventObject as any)?.current_period_end
        || (data as any)?.subscription?.current_period_end
        || null);
    
    // 获取 customerId（优先使用官方标准格式）
    const customerId = eventObject.customer?.id 
      || (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id)
      || data.customer?.id;
    
    const rawStatus = subscription.status || (eventObject as any)?.status || targetStatus;

    console.log(`🔄 Updating subscription for user: ${userId}`, {
      plan,
      productId,
      subscriptionId,
      customerId,
      status: rawStatus,
      periodEnd,
      eventType: data.eventType || data.type,
    });
    
    await subscriptionService.updateSubscription(
      userId,
      plan,
      subscriptionId,
      customerId,
      rawStatus,
      periodEnd
    );
    
    console.log(`✅ Subscription updated successfully for user: ${userId}`);
  } catch (error: any) {
    console.error('❌ Error updating subscription:', error);
    console.error('❌ Error stack:', error.stack);
  }
}

/**
 * 处理 subscription.paid 和 subscription.trialing 事件
 * 这些事件会强制增加试穿次数
 */
/**
 * 处理 credits 购买（onetime 产品）
 * 从产品信息中提取 credits 数量并添加到用户账户
 */
async function handleCreditsPurchase(
  userId: string,
  productId: string,
  subscriptionService: SubscriptionService,
  creem: ReturnType<typeof createCreem>
): Promise<boolean> {
  try {
    // 获取产品详情
    const product = await creem.products.get({ productId });
    
    // 检查是否是 credits 产品（onetime 类型，名称包含 "Credits"）
    if (product && product.billingType === 'onetime' && product.name.includes('Credits')) {
      // 从产品名称中提取 credits 数量
      const creditsMatch = product.name.match(/(\d+)\s*Credits?/i);
      const credits = creditsMatch ? parseInt(creditsMatch[1]) : 0;

      if (credits > 0) {
        console.log(`💰 Processing credits purchase: ${credits} credits for user: ${userId}`);
        await subscriptionService.addTries(userId, credits);
        console.log(`✅ Successfully added ${credits} credits for user: ${userId}`);
        return true; // 是 credits 购买
      }
    }
    
    return false; // 不是 credits 购买
  } catch (error: any) {
    console.warn(`⚠️ Could not fetch product details for ${productId}:`, error.message);
    return false;
  }
}

/**
 * 更新订阅数据库内容（只处理订阅信息，不涉及 credits）
 */
async function updateSubscriptionFromWebhook(
  data: any,
  subscriptionService: SubscriptionService,
  creem: ReturnType<typeof createCreem>,
  isTestMode: boolean,
  eventType: string
) {
  // 根据官方文档，事件格式为：{ id, eventType, object, created_at, mode }
  // 优先使用 object 字段（官方标准格式）
  const eventObject = data.object || data.subscription || data;
  
  // 尝试多种方式获取 subscriptionId
  const subscriptionId = eventObject.id || data.subscription?.id || data.id;
  
  if (!subscriptionId) {
    console.error(`❌ No subscription ID found in ${eventType} event`);
    return;
  }

  // 尝试多种方式获取 userId
  let userId = 
    eventObject.metadata?.userId ||
    eventObject.metadata?.user_id ||
    data.checkout?.metadata?.userId || 
    data.checkout?.metadata?.user_id ||
    data.metadata?.userId || 
    data.metadata?.user_id ||
    data.subscription?.metadata?.userId ||
    data.subscription?.metadata?.user_id;

  // 如果 metadata 中没有 userId，从数据库查找
  if (!userId) {
    try {
      const { data: subscriptionData, error: queryError } = await subscriptionService['table']
        .select('user_id')
        .eq('creem_subscription_id', subscriptionId)
        .single();

      if (!queryError && subscriptionData?.user_id) {
        userId = subscriptionData.user_id;
      }
    } catch (dbError: any) {
      console.warn(`⚠️ Error querying database for ${eventType} event:`, dbError.message);
    }
  }

  if (!userId) {
    // 对于测试模式或测试事件，这是预期的行为（测试数据中没有真实的 userId）
    if (isTestMode || data.mode === 'test') {
      console.warn(`⚠️ Test event: Could not find userId for ${eventType} event, subscriptionId: ${subscriptionId}. This is expected for test webhooks.`);
    } else {
      console.error(`❌ Could not find userId for ${eventType} event, subscriptionId: ${subscriptionId}`);
    }
    return;
  }

  try {
    // 从 eventObject 中获取订阅信息（根据官方示例，数据在 object 字段中）
    const productId = eventObject.product?.id 
      || eventObject.items?.[0]?.productId
      || (data.subscription as any)?.product?.id
      || (data.subscription as any)?.items?.[0]?.productId;

    if (!productId) {
      // 如果 eventObject 中没有，尝试从 Creem API 获取
      const subscription = await creem.subscriptions.get({ subscriptionId });
      const fetchedProductId = getProductIdFromSubscription(subscription);
      if (!fetchedProductId) {
        console.error(`❌ Could not determine productId for ${eventType} event`);
        return;
      }
      // 使用从 API 获取的数据
      const plan = getPlanFromProductId(fetchedProductId);
      const periodEnd = subscription.currentPeriodEndDate 
        ? toISOString(subscription.currentPeriodEndDate)
        : null;
      const customerId = typeof subscription.customer === 'string' 
        ? subscription.customer 
        : subscription.customer?.id;

      const rawStatus = subscription.status || (eventObject as any)?.status || 'active';

      await subscriptionService.updateSubscription(
        userId,
        plan,
        subscriptionId,
        customerId || null,
        rawStatus,
        periodEnd,
        subscription.lastTransactionId || null
      );

      console.log(`✅ Subscription ${eventType} processed for user: ${userId}`);
      return;
    }

    const plan = getPlanFromProductId(productId);
    
    // 从 eventObject 中获取 period_end（根据官方示例，字段名可能是 snake_case 或 camelCase）
    const periodEnd = eventObject.current_period_end_date || eventObject.currentPeriodEndDate
      ? toISOString(eventObject.current_period_end_date || eventObject.currentPeriodEndDate)
      : null;
    
    // 从 eventObject 中获取 last_transaction_id（根据官方示例，字段名可能是 snake_case 或 camelCase）
    const lastTransactionId = eventObject.last_transaction_id || eventObject.lastTransactionId || null;
    
    const customerId = eventObject.customer?.id || data.customer?.id;

    console.log(`💰 Processing ${eventType} event for user: ${userId}`, {
      subscriptionId,
      productId,
      plan,
      periodEnd,
      lastTransactionId,
    });

    // 调用 updateSubscription 更新订阅数据库内容
    await subscriptionService.updateSubscription(
      userId,
      plan,
      subscriptionId,
      customerId || null,
      'active',
      periodEnd,
      lastTransactionId
    );

    console.log(`✅ Subscription ${eventType} processed for user: ${userId}`);
  } catch (error: any) {
    console.error(`❌ Error processing ${eventType} event:`, error);
    console.error('❌ Error stack:', error.stack);
  }
}

/**
 * 共享的 webhook 事件处理逻辑
 */
const createWebhookHandler = (
  subscriptionService: SubscriptionService,
  creem: ReturnType<typeof createCreem>,
  isTestMode: boolean,
  env: Env
) => {
  return {
      // 结账完成事件 - 只打印日志
      onCheckoutCompleted: async (data: any) => {
        console.log('✅ Checkout completed:', {
          eventType: data.eventType || 'checkout.completed',
          checkoutId: data.checkout?.id || data.object?.id,
          customerEmail: data.customer?.email,
          customerId: data.customer?.id,
          subscriptionId: data.subscription?.id,
          metadata: data.checkout?.metadata,
        });
      },

      // 授予访问权限事件
      onGrantAccess: async (context: any) => {
        console.log('🔓 Grant access:', {
          customerId: context.customer?.id,
          subscriptionId: context.subscription?.id,
          metadata: context.metadata,
        });

        const userId = context.metadata?.userId;
        if (userId && context.subscription?.id) {
          try {
            // 获取订阅详情以获取产品ID
            const subscription = await creem.subscriptions.get({
              subscriptionId: context.subscription.id,
            });
            
            // 从订阅中获取产品ID
            let productId: string | undefined;
            if (subscription.items && subscription.items.length > 0 && subscription.items[0].productId) {
              productId = subscription.items[0].productId;
            } else if (typeof subscription.product === 'string') {
              productId = subscription.product;
            } else if (subscription.product && typeof subscription.product === 'object' && 'id' in subscription.product) {
              productId = subscription.product.id;
            }
            
            // 如果从 subscription 中获取不到，尝试从 context 中获取
            if (!productId) {
              productId = (context.subscription as any)?.items?.[0]?.productId
                || (context.subscription as any)?.productId;
            }
            
            const plan = getPlanFromProductId(productId);
            
            await subscriptionService.updateSubscription(
              userId,
              plan,
              context.subscription.id,
              context.customer?.id,
              'active'
            );
            console.log(`✅ Access granted for user: ${userId}`);
          } catch (error: any) {
            console.error('❌ Error granting access:', error);
          }
        }
      },

      // 撤销访问权限事件
      onRevokeAccess: async (context: any) => {
        console.log('🔒 Revoke access:', {
          customerId: context.customer?.id,
          subscriptionId: context.subscription?.id,
          metadata: context.metadata,
        });

        const userId = context.metadata?.userId;
        if (userId) {
          try {
            // 撤销访问时，保持当前 plan 但状态设为 canceled
            await subscriptionService.updateSubscription(
              userId,
              'member',
              null,
              null,
              'canceled'
            );
            console.log(`✅ Access revoked for user: ${userId}`);
          } catch (error: any) {
            console.error('❌ Error revoking access:', error);
          }
        }
      },

      // 订阅激活事件 - 只打印日志
      onSubscriptionActive: async (data: any) => {
        console.log('✅ Subscription active (log only):', {
          eventType: data.eventType || 'subscription.active',
          subscriptionId: data.object?.id || data.subscription?.id || data.id,
          customerId: data.object?.customer?.id || data.customer?.id,
        });
      },

      // 订阅试用事件 - 只打印日志
      onSubscriptionTrialing: async (data: any) => {
        console.log('🆓 Subscription trialing:', {
          eventType: data.eventType || 'subscription.trialing',
          subscriptionId: data.object?.id || data.subscription?.id || data.id,
          customerId: data.object?.customer?.id || data.customer?.id,
          lastTransactionId: data.object?.last_transaction_id,
          periodEnd: data.object?.current_period_end_date,
        });
      },

      // 订阅已支付事件 - 处理 credits 购买或更新订阅
      onSubscriptionPaid: async (data: any) => {
        console.log('💰 Subscription paid:', {
          eventType: data.eventType || 'subscription.paid',
          subscriptionId: data.object?.id || data.subscription?.id || data.id,
          customerId: data.object?.customer?.id || data.customer?.id,
          lastTransactionId: data.object?.last_transaction_id,
          lastTransactionDate: data.object?.last_transaction_date,
          periodEnd: data.object?.current_period_end_date,
        });

        const eventObject = data.object || data.subscription || data;
        const subscriptionId = eventObject.id || data.subscription?.id || data.id;
        
        if (!subscriptionId) {
          console.error('❌ No subscription ID found in paid event');
          return;
        }

        // 尝试多种方式获取 userId
        let userId = 
          eventObject.metadata?.userId ||
          eventObject.metadata?.user_id ||
          data.checkout?.metadata?.userId || 
          data.checkout?.metadata?.user_id ||
          data.metadata?.userId || 
          data.metadata?.user_id ||
          data.subscription?.metadata?.userId ||
          data.subscription?.metadata?.user_id;

        // 如果 metadata 中没有 userId，从数据库查找
        if (!userId) {
          try {
            const { data: subscriptionData, error: queryError } = await subscriptionService['table']
              .select('user_id')
              .eq('creem_subscription_id', subscriptionId)
              .single();

            if (!queryError && subscriptionData?.user_id) {
              userId = subscriptionData.user_id;
            }
          } catch (dbError: any) {
            console.warn(`⚠️ Error querying database for paid event:`, dbError.message);
          }
        }

        if (!userId) {
          console.warn(`⚠️ Could not find userId for paid event, subscriptionId: ${subscriptionId}`);
          return;
        }

        // 获取产品ID
        const productId = eventObject.product?.id 
          || eventObject.items?.[0]?.productId
          || (data.subscription as any)?.product?.id
          || (data.subscription as any)?.items?.[0]?.productId;

        if (productId) {
          // 先检查是否是 credits 购买
          const isCreditsPurchase = await handleCreditsPurchase(
            userId,
            productId,
            subscriptionService,
            creem
          );

          // 如果是 credits 购买，直接返回，不需要更新订阅
          if (isCreditsPurchase) {
            return;
          }
        }

        // 如果不是 credits 购买，更新订阅数据库内容
        await updateSubscriptionFromWebhook(
          data,
          subscriptionService,
          creem,
          isTestMode,
          'paid'
        );
      },

      // 订阅创建事件 - 只打印日志
      onSubscriptionCreated: async (data: any) => {
        console.log('📝 Subscription created:', {
          eventType: data.eventType || 'subscription.created',
          subscriptionId: data.object?.id || data.subscription?.id || data.id,
          customerId: data.object?.customer?.id || data.customer?.id,
          productId: data.object?.product?.id || data.subscription?.items?.[0]?.productId,
        });
      },

      // 订阅更新事件 - 只打印日志
      onSubscriptionUpdated: async (data: any) => {
        console.log('🔄 Subscription updated (log only):', {
          eventType: data.eventType,
          subscriptionId: data.object?.id || data.subscription?.id || data.id,
          customerId: data.object?.customer?.id || data.customer?.id,
        });
      },

      // 订阅取消事件
      onSubscriptionCanceled: async (data: any) => {
        console.log('❌ Subscription canceled webhook received');
        console.log('📋 Full webhook data:', JSON.stringify(data, null, 2));
        
        // 根据 Creem 文档，webhook 数据结构可能是：
        // 1. data.object.id (标准格式)
        // 2. data.subscription.id (SDK 可能转换后的格式)
        // 3. data.id (直接是订阅ID)
        const subscriptionId = data.object?.id 
          || data.subscription?.id 
          || data.id;
        
        console.log('🔍 Extracted subscription ID:', subscriptionId);
        console.log('📋 Webhook data structure:', {
          hasObject: !!data.object,
          hasSubscription: !!data.subscription,
          objectId: data.object?.id,
          subscriptionId: data.subscription?.id,
          directId: data.id,
        });

        if (!subscriptionId) {
          console.error('❌ No subscription ID found in webhook data. Cannot update subscription.');
          console.error('📋 Full webhook data structure:', JSON.stringify(data, null, 2));
          return;
        }

        // 尝试多种方式获取 userId
        // 根据 Creem 文档，metadata 可能在 object.metadata 或顶层 metadata
        let userId = data.object?.metadata?.userId
          || data.metadata?.userId 
          || data.subscription?.metadata?.userId
          || data.checkout?.metadata?.userId
          || data.customer?.metadata?.userId
          || data.object?.subscription?.metadata?.userId;

        // 如果 metadata 中没有 userId，从数据库查找
        if (!userId) {
          console.log('🔍 userId not found in metadata, querying database...');
          try {
            const { data: subscriptionData, error: queryError } = await subscriptionService['table']
              .select('user_id')
              .eq('creem_subscription_id', subscriptionId)
              .single();

            if (queryError || !subscriptionData) {
              console.error('❌ Could not find user_id for subscription:', {
                subscriptionId,
                error: queryError?.message,
                code: queryError?.code,
              });
              console.error('📋 Full webhook data structure:', JSON.stringify(data, null, 2));
              return;
            }

            userId = subscriptionData.user_id;
            console.log(`✅ Found user_id ${userId} for subscription ${subscriptionId} from database`);
          } catch (dbError: any) {
            console.error('❌ Error querying database for user_id:', dbError);
            console.error('📋 Full webhook data structure:', JSON.stringify(data, null, 2));
            return;
          }
        } else {
          console.log(`✅ Found userId from metadata: ${userId}`);
        }

        if (!userId) {
          console.error('❌ No userId found after all attempts. Cannot update subscription.');
          return;
        }

        try {
          // 获取订阅详情以获取 period_end
          const subscription = await creem.subscriptions.get({
            subscriptionId,
          });
          
          // 获取 period_end（使用类型定义中的 currentPeriodEndDate）
          const periodEnd = subscription.currentPeriodEndDate 
            ? toISOString(subscription.currentPeriodEndDate)
            : ((data as any)?.object?.current_period_end_date || null);
          
          // 获取产品ID以确定套餐类型
          let productId = getProductIdFromSubscription(subscription);
          
          // 如果从 subscription 中获取不到，尝试从 data 中获取
          if (!productId) {
            productId = (data as any)?.object?.product?.id
              || (data as any)?.subscription?.items?.[0]?.productId
              || (data as any)?.subscription?.productId
              || (data as any)?.object?.items?.[0]?.product_id;
          }
          
          const plan = getPlanFromProductId(productId);
          
          console.log('📅 Subscription period end:', periodEnd);
          console.log('📦 Plan determined from product ID:', { productId, plan });
          
          // 保持原套餐，但状态设为 canceled，并保存 period_end
          // 这样用户可以在剩余时间内继续使用高级功能
          await subscriptionService.updateSubscription(
            userId,
            plan, // 保持原套餐，直到 period_end
            subscriptionId,
            data.object?.customer?.id || data.customer?.id,
            'canceled',
            periodEnd
          );
          console.log(`✅ Subscription canceled for user: ${userId}, period ends at: ${periodEnd}`);
          
          // 验证更新是否成功
          const { data: verifyData } = await subscriptionService['table']
            .select('status')
            .eq('user_id', userId)
            .single();
          console.log(`🔍 Verified database status after webhook update:`, verifyData?.status);
        } catch (error: any) {
          console.error('❌ Error canceling subscription:', error);
          console.error('❌ Error stack:', error.stack);
        }
      },

      // 支付成功事件
      // 注意：credits 处理只在 checkout.completed 事件中进行
      onPaymentSucceeded: async (data: any) => {
        console.log('💳 Payment succeeded:', {
          transactionId: data.transaction?.id,
          amount: data.transaction?.amount,
          customerId: data.customer?.id,
          productId: data.transaction?.productId || data.product?.id,
          productName: data.product?.name || data.transaction?.product?.name,
        });

        // Credits 处理已移至 checkout.completed 事件
        // 此事件仅用于日志记录，不处理 credits
      },

      // 支付失败事件
      onPaymentFailed: async (data: any) => {
        console.log('⚠️ Payment failed:', {
          transactionId: data.transaction?.id,
          customerId: data.customer?.id,
          error: data.transaction?.error,
        });
      },

      // 订阅过期事件（根据官方文档：subscription.expired）
      onSubscriptionExpired: async (data: any) => {
        console.log('⏰ Subscription expired:', {
          subscriptionId: data.object?.id || data.subscription?.id || data.id,
          customerId: data.object?.customer?.id || data.customer?.id,
          eventType: data.eventType || 'subscription.expired',
        });

        // 订阅过期后，降级到免费计划
        const subscriptionId = data.object?.id || data.subscription?.id || data.id;
        if (!subscriptionId) {
          console.warn('⚠️ No subscription ID found in expired event');
          return;
        }

        // 尝试从数据库查找 userId 和当前的 plan
        try {
          const { data: subscriptionData, error: queryError } = await subscriptionService['table']
            .select('user_id, plan')
            .eq('creem_subscription_id', subscriptionId)
            .single();

          if (queryError || !subscriptionData) {
            console.warn(`⚠️ Could not find user_id for expired subscription ${subscriptionId}`);
            return;
          }

          const userId = subscriptionData.user_id;
          // 保持当前 plan，但状态设为 expired
          if (!subscriptionData.plan) {
            throw new Error(`Plan is missing for user ${userId} in expired subscription ${subscriptionId}`);
          }
          const currentPlan = subscriptionData.plan as PlanType;

          await subscriptionService.updateSubscription(
            userId,
            currentPlan,
            null,
            null,
            'expired'
          );

          console.log(`✅ Subscription expired, user ${userId} status set to expired`);
        } catch (error: any) {
          console.error('❌ Error processing subscription expired event:', error);
        }
      },

      // 订阅暂停事件（根据官方文档：subscription.paused）
      onSubscriptionPaused: async (data: any) => {
        console.log('⏸️ Subscription paused:', {
          eventType: data.eventType || 'subscription.paused',
          subscriptionId: data.object?.id || data.subscription?.id || data.id,
          customerId: data.object?.customer?.id || data.customer?.id,
        });

        // 订阅暂停时，保持当前计划但标记为暂停状态
        const subscriptionId = data.object?.id || data.subscription?.id || data.id;
        if (!subscriptionId) {
          console.warn('⚠️ No subscription ID found in paused event');
          return;
        }

        try {
          // 从数据库查找 userId
          const { data: subscriptionData, error: queryError } = await subscriptionService['table']
            .select('user_id')
            .eq('creem_subscription_id', subscriptionId)
            .single();

          if (queryError || !subscriptionData) {
            console.warn(`⚠️ Could not find user_id for paused subscription ${subscriptionId}`);
            return;
          }

          const userId = subscriptionData.user_id;

          // 获取订阅详情以获取产品ID、状态和 period_end（与 Creem SDK 对齐）
          const subscription = await creem.subscriptions.get({
            subscriptionId,
          });

          // 获取产品ID（支持所有 string 类型）
          let productId = getProductIdFromSubscription(subscription);
          
          // 如果从 subscription 中获取不到，尝试从 data 中获取
          if (!productId) {
            productId = typeof (data as any)?.object?.product === 'string'
              ? (data as any)?.object?.product
              : (data as any)?.object?.product?.id;
          }
          
          const plan = getPlanFromProductId(productId);
          
          // 获取 period_end（使用 Creem SDK 的 currentPeriodEndDate 字段）
          const periodEnd = subscription.currentPeriodEndDate 
            ? toISOString(subscription.currentPeriodEndDate)
            : null;

          // 获取 customerId（支持所有 string 类型，与 Creem SDK 对齐）
          const customerId = typeof subscription.customer === 'string' 
            ? subscription.customer 
            : subscription.customer?.id 
            || (typeof (data as any)?.object?.customer === 'string'
              ? (data as any)?.object?.customer
              : (data as any)?.object?.customer?.id)
            || (data as any)?.customer?.id;
          
          // 使用 subscription.status（Creem SDK 返回的状态，支持所有 string 类型）
          const subscriptionStatus = subscription.status;
          
          await subscriptionService.updateSubscription(
            userId,
            plan,
            subscriptionId,
            customerId || null,
            subscriptionStatus || 'active',
            periodEnd
          );

          console.log(`✅ Subscription paused for user ${userId}`, {
            status: subscriptionStatus,
            periodEnd,
            customerId,
          });
        } catch (error: any) {
          console.error('❌ Error processing subscription paused event:', error);
        }
      },
  };
};

/**
 * POST /webhook
 * 处理 Creem.io webhook 事件（生产环境）
 * Webhook URL: https://fashion.hdz73.com/webhook
 * 
 * 根据官方文档：https://docs.creem.io/code/webhooks
 * - 事件格式：{ id, eventType, object, created_at, mode }
 * - 必须返回 HTTP 200 OK 表示成功接收
 * - 签名验证通过 creem-signature header
 */
app.post('/webhook', async (c) => {
  try {
    const { subscriptionService, creem, isTestMode, creemWebhookSecret } = getServices(c);
    // 获取原始请求体（字符串格式，用于签名验证）
    const rawBody = await c.req.text();
    
    // 获取签名头（根据官方文档）
    const signature = c.req.header('creem-signature');

    // 解析事件数据（用于日志记录）
    let eventInfo: any = {};
    try {
      const parsedBody = JSON.parse(rawBody);
      eventInfo = {
        eventId: parsedBody.id,
        eventType: parsedBody.eventType || parsedBody.type || 'unknown',
        mode: parsedBody.mode || 'unknown',
        hasObject: !!parsedBody.object,
      };
    } catch (e) {
      // 如果解析失败，继续处理（SDK 会处理）
    }

    console.log('🌐 Production webhook received:', {
      ...eventInfo,
      hasBody: !!rawBody,
      bodyLength: rawBody?.length || 0,
      hasSignature: !!signature,
    });

    if (!signature) {
      console.warn('⚠️ Webhook request missing creem-signature header');
      // 根据官方文档，即使缺少签名也要返回 200，但记录警告
      // 实际生产环境应该返回 400，但为了兼容性先返回 200
      return c.json({ received: false, error: 'Missing signature header' }, 200);
    }

    if (!creemWebhookSecret) {
      console.error(`❌ ${isTestMode ? '测试' : '生产'}环境 Webhook Secret 未配置`);
      // 配置错误时返回 500
      return c.json({ error: 'Webhook secret not configured' }, 500);
    }

    // 使用 Creem SDK 处理 webhook 事件（自动验证签名）
    // SDK 会验证签名并调用相应的 handler
    await creem.webhooks.handleEvents(rawBody, signature, createWebhookHandler(subscriptionService, creem, isTestMode, c.env));

    // 根据官方文档，必须返回 HTTP 200 OK 表示成功接收
    // Creem 会根据响应状态码决定是否重试
    return c.json({ received: true, eventType: eventInfo.eventType }, 200);
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    
    // 如果是签名验证失败，记录错误但返回 200（避免 Creem 重试无效请求）
    // 实际应该返回 401，但为了兼容性先返回 200
    if (error.message?.includes('signature') || error.message?.includes('verification')) {
      console.error('❌ Invalid webhook signature:', error.message);
      // 返回 200 但记录错误，避免 Creem 无限重试
      return c.json(
        {
          received: false,
          error: 'Invalid webhook signature',
          message: error.message,
        },
        200
      );
    }

    // 其他错误也返回 200，但记录详细错误信息
    // 这样 Creem 不会重试，但我们可以在日志中看到问题
    console.error('❌ Webhook processing failed:', {
      message: error.message,
      stack: error.stack,
    });
    
    return c.json(
      {
        received: false,
        error: 'Webhook processing failed',
        message: error.message || 'Unknown error',
      },
      200
    );
  }
});

/**
 * POST /test-webhook
 * 处理 Creem.io webhook 事件（测试环境）
 * Webhook URL: https://fashion.hdz73.com/test-webhook
 * 
 * 根据官方文档：https://docs.creem.io/code/webhooks
 * - 事件格式：{ id, eventType, object, created_at, mode }
 * - 必须返回 HTTP 200 OK 表示成功接收
 */
app.post('/test-webhook', async (c) => {
  try {
    const { subscriptionService, creem, isTestMode, creemWebhookSecret } = getServices(c);
    // 获取原始请求体（字符串格式，用于签名验证）
    const rawBody = await c.req.text();
    
    // 获取签名头（根据官方文档）
    const signature = c.req.header('creem-signature');

    // 解析事件数据（用于调试和日志）
    let eventInfo: any = {};
    try {
      const parsedBody = JSON.parse(rawBody);
      eventInfo = {
        eventId: parsedBody.id,
        eventType: parsedBody.eventType || parsedBody.type || parsedBody.event || 'unknown',
        mode: parsedBody.mode || 'unknown',
        hasObject: !!parsedBody.object,
        hasCheckout: !!parsedBody.checkout,
        hasCustomer: !!parsedBody.customer,
        hasSubscription: !!parsedBody.subscription,
        checkoutMetadata: parsedBody.checkout?.metadata,
      };
      console.log('📦 Test webhook event details:', eventInfo);
    } catch (e) {
      console.warn('⚠️ Could not parse webhook body as JSON');
    }

    console.log('🧪 Test webhook received:', {
      ...eventInfo,
      hasBody: !!rawBody,
      bodyLength: rawBody?.length || 0,
      hasSignature: !!signature,
      headers: Object.keys(c.req.raw.headers),
      isTestMode,
      hasWebhookSecret: !!creemWebhookSecret,
      webhookSecretPrefix: creemWebhookSecret ? creemWebhookSecret.substring(0, 10) + '...' : 'not set',
    });

    if (!signature) {
      console.warn('⚠️ Test webhook request missing creem-signature header');
      // 测试环境也返回 200，但记录警告
      return c.json({ received: false, error: 'Missing signature header', environment: 'test' }, 200);
    }

    if (!creemWebhookSecret) {
      console.error(`❌ ${isTestMode ? '测试' : '生产'}环境 Webhook Secret 未配置`);
      console.error(`   请检查环境变量: ${isTestMode ? 'CREEM_TEST_WEBHOOK_SECRET' : 'CREEM_PROD_WEBHOOK_SECRET'}`);
      return c.json({ error: 'Webhook secret not configured' }, 500);
    }
    
    // 使用 Creem SDK 处理 webhook 事件（自动验证签名）
    await creem.webhooks.handleEvents(rawBody, signature, createWebhookHandler(subscriptionService, creem, isTestMode, c.env));

    // 根据官方文档，必须返回 HTTP 200 OK
    return c.json({ received: true, environment: 'test', eventType: eventInfo.eventType }, 200);
  } catch (error: any) {
    console.error('❌ Test webhook processing error:', error);
    
    // 如果是签名验证失败，记录错误但返回 200（避免 Creem 重试）
    if (error.message?.includes('signature') || error.message?.includes('verification')) {
      console.error('❌ Invalid test webhook signature:', error.message);
      return c.json(
        {
          received: false,
          error: 'Invalid webhook signature',
          message: error.message,
          environment: 'test',
        },
        200
      );
    }

    // 其他错误也返回 200，但记录详细错误信息
    console.error('❌ Test webhook processing failed:', {
      message: error.message,
      stack: error.stack,
    });

    return c.json(
      {
        received: false,
        error: 'Test webhook processing failed',
        message: error.message || 'Unknown error',
        environment: 'test',
      },
      200
    );
  }
});

// ==================== Subscription Routes ====================

/**
 * GET /subscriptions/:subscriptionId
 * 获取订阅详情
 */
app.get('/subscriptions/:subscriptionId', async (c) => {
  try {
    const { creem } = getServices(c);
    const subscriptionId = c.req.param('subscriptionId');

    if (!subscriptionId) {
      return c.json({ error: 'Subscription ID is required' }, 400);
    }

    const subscription = await creem.subscriptions.get({
      subscriptionId,
    });

    return c.json(subscription);
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return c.json(
      {
        error: 'Failed to fetch subscription',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /subscriptions/:subscriptionId/update
 * 更新订阅（例如修改座位数或单位数）
 */
app.post('/subscriptions/:subscriptionId/update', async (c) => {
  try {
    const { creem } = getServices(c);
    const subscriptionId = c.req.param('subscriptionId');
    const body = await c.req.json();

    if (!subscriptionId) {
      return c.json({ error: 'Subscription ID is required' }, 400);
    }

    // 首先获取订阅以获取 item ID
    const currentSubscription = await creem.subscriptions.get({
      subscriptionId,
    });

    if (!currentSubscription.items || currentSubscription.items.length === 0) {
      return c.json({ error: 'Subscription has no items' }, 400);
    }

    const itemId = currentSubscription.items[0].id;

    // 更新订阅
    const updatedSubscription = await creem.subscriptions.update({
      subscriptionId,
      items: [
        {
          id: itemId,
          units: body.units || currentSubscription.items[0].units,
        },
      ],
      updateBehavior: body.updateBehavior,
    });

    return c.json(updatedSubscription);
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return c.json(
      {
        error: 'Failed to update subscription',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /subscriptions/:subscriptionId/upgrade
 * 升级或降级订阅到不同的产品
 */
app.post('/subscriptions/:subscriptionId/upgrade', async (c) => {
  let body: any = null;
  try {
    const { creem } = getServices(c);
    const subscriptionId = c.req.param('subscriptionId');
    body = await c.req.json();

    if (!subscriptionId) {
      return c.json({ error: 'Subscription ID is required' }, 400);
    }

    if (!body.productId) {
      return c.json({ error: 'Product ID is required' }, 400);
    }

    console.log('Upgrading subscription:', {
      subscriptionId,
      productId: body.productId,
      updateBehavior: body.updateBehavior,
    });

    const upgradedSubscription = await creem.subscriptions.upgrade({
      subscriptionId,
      productId: body.productId,
      updateBehavior: body.updateBehavior,
    });

    console.log('Subscription upgraded successfully:', upgradedSubscription);

    // 升级/降级成功后，立即更新数据库
    // 这样能确保试穿次数逻辑正确执行（升级/降级时保持次数不变）
    try {
      const { subscriptionService, creem, isTestMode } = getServices(c);
      
      // 从订阅的metadata中获取用户ID
      const userId = upgradedSubscription.metadata?.userId 
        ? String(upgradedSubscription.metadata.userId)
        : null;
      
      if (userId) {
        // 获取产品ID和计划类型
        const productId = getProductIdFromSubscription(upgradedSubscription);
        if (productId) {
          const plan = getPlanFromProductId(productId);
          const periodEnd = toISOString(upgradedSubscription.currentPeriodEndDate);
          const customerId: string | null = typeof upgradedSubscription.customer === 'string' 
            ? upgradedSubscription.customer 
            : (upgradedSubscription.customer?.id ? String(upgradedSubscription.customer.id) : null);
          
          // 确定订阅状态（原样存储 Creem 状态）
          const creemStatus = upgradedSubscription.status || 'active';
          
          // 调用 updateSubscription 更新数据库
          // 这会触发试穿次数逻辑：升级/降级时保持次数不变，只有续费时才增加
          await subscriptionService.updateSubscription(
            userId,
            plan,
            String(upgradedSubscription.id),
            customerId || null,
            creemStatus,
            periodEnd
          );
          
          console.log(`✅ Database updated after upgrade/downgrade for user: ${userId}, plan: ${plan}`);
        } else {
          console.warn('⚠️ Could not determine product ID from upgraded subscription, skipping database update');
        }
      } else {
        console.warn('⚠️ No userId found in subscription metadata, skipping database update');
      }
    } catch (updateError: any) {
      // 数据库更新失败不应该影响升级操作的返回
      // 因为 Creem 端的订阅已经成功升级了
      console.error('⚠️ Failed to update database after upgrade/downgrade:', updateError);
    }

    return c.json(upgradedSubscription);
  } catch (error: any) {
    console.error('Error upgrading subscription:', error);
    
    // Provide more detailed error information
    let errorMessage = error.message || 'Unknown error';
    let statusCode: 403 | 404 | 500 = 500;
    const { isTestMode } = getServices(c);
    
    if (error.message?.includes('Forbidden') || error.status === 403 || error.statusCode === 403) {
      statusCode = 403;
      errorMessage = 'Upgrade/downgrade operation is not permitted. This may be due to API permissions or subscription restrictions. Please use the customer portal to manage your subscription.';
    } else if (error.message?.includes('Not Found') || error.message?.includes('does not exist') || error.status === 404 || error.statusCode === 404) {
      statusCode = 404;
      const currentEnv = isTestMode ? 'test' : 'production';
      errorMessage = `Subscription not found. This may be because:
1. The subscription ID does not exist in the ${currentEnv} environment
2. The subscription was created in a different environment (${isTestMode ? 'production' : 'test'})
3. The subscription has been deleted or canceled

Please verify that the subscription ID matches the current environment (${currentEnv}).`;
    }
    
    return c.json(
      {
        error: 'Failed to upgrade subscription',
        message: errorMessage,
        details: c.env.NODE_ENV === 'development' ? {
          originalError: error.message,
          status: error.status || error.statusCode,
          subscriptionId: c.req.param('subscriptionId'),
          productId: body?.productId,
          currentEnvironment: isTestMode ? 'test' : 'production',
          suggestion: error.message?.includes('does not exist') 
            ? `The subscription may be in the ${isTestMode ? 'production' : 'test'} environment. Check CREEM_TEST_MODE setting.`
            : undefined,
        } : undefined,
      },
      statusCode
    );
  }
});

/**
 * POST /subscriptions/:subscriptionId/cancel
 * 取消订阅
 */
app.post('/subscriptions/:subscriptionId/cancel', async (c) => {
  try {
    const { creem, subscriptionService, isTestMode, env } = getServices(c);
    const subscriptionId = c.req.param('subscriptionId');

    console.log('🚫 Canceling subscription:', {
      subscriptionId,
      environment: isTestMode ? 'TEST' : 'PRODUCTION',
    });

    if (!subscriptionId) {
      return c.json({ error: 'Subscription ID is required' }, 400);
    }

    let canceledSubscription: any;
    let subscriptionAlreadyCanceled = false;

    try {
      // 先检查订阅当前状态
      const currentSubscription = await creem.subscriptions.get({
        subscriptionId,
      });
      const currentStatus = currentSubscription.status;
      
      console.log(`📋 Current subscription status: ${currentStatus}`);
      
      // 如果订阅已经是 canceled，不需要再次取消
      if (currentStatus === 'canceled') {
        console.log(`ℹ️ Subscription is already ${currentStatus}, skipping cancel API call`);
        subscriptionAlreadyCanceled = true;
        canceledSubscription = currentSubscription;
      } else {
        // 取消订阅
        console.log(`🔄 Calling Creem API to cancel subscription: ${subscriptionId}`);
        canceledSubscription = await creem.subscriptions.cancel({
          subscriptionId,
          mode: 'scheduled',
        } as any);
        console.log('✅ Subscription canceled in Creem:', {
          subscriptionId: canceledSubscription.id || subscriptionId,
          status: canceledSubscription.status,
        });
      }
    } catch (cancelError: any) {
      // 如果错误是"订阅已取消"，我们仍然应该同步状态
      if (cancelError.message?.includes('already canceled') || cancelError.message?.includes('already cancelled')) {
        console.log('ℹ️ Subscription is already canceled, fetching current status...');
        subscriptionAlreadyCanceled = true;
        try {
          // 获取当前订阅状态以进行同步
          canceledSubscription = await creem.subscriptions.get({
            subscriptionId,
          });
        } catch (getError: any) {
          // 如果获取也失败，记录错误但继续尝试同步数据库
          console.warn('⚠️ Could not fetch subscription status, but will still try to sync database:', getError.message);
        }
      } else {
        // 其他错误，抛出
        throw cancelError;
      }
    }

    // 同步更新数据库状态
    try {
      // 1. 从数据库查找 userId
      const { data: subscriptionData, error: queryError } = await subscriptionService['table']
        .select('user_id')
        .eq('creem_subscription_id', subscriptionId)
        .single();

      if (queryError || !subscriptionData) {
        console.warn(`⚠️ Could not find user_id for subscription ${subscriptionId}. Webhook may handle this.`, queryError?.message);
      } else {
        const userId = subscriptionData.user_id;
        console.log(`🔍 Found user_id ${userId} for subscription ${subscriptionId}`);

        // 2. 获取订阅详情以获取 period_end 和 productId
        // 如果订阅已经取消，使用 canceledSubscription；否则重新获取
        const subscription = canceledSubscription || await creem.subscriptions.get({
          subscriptionId,
        });

        // 获取 period_end（使用类型定义中的 currentPeriodEndDate）
        const periodEnd = subscription.currentPeriodEndDate 
          ? toISOString(subscription.currentPeriodEndDate)
          : null;
        
        // 获取 last_transaction_id（保留原有值，不改变）
        const lastTransactionId = subscription.lastTransactionId || null;
        
        // 获取产品ID以确定套餐类型
        let productId = getProductIdFromSubscription(subscription);
        
        // 如果从 subscription 中获取不到，尝试从 canceledSubscription 中获取
        if (!productId && canceledSubscription) {
          productId = getProductIdFromSubscription(canceledSubscription);
        }
        
        const plan = getPlanFromProductId(productId);
        
        console.log('📅 Subscription period end:', periodEnd);
        console.log('📦 Plan determined from product ID:', { productId, plan });

        // 3. 更新数据库状态为 canceled
        // 注意：即使订阅在 Creem 端已经是 canceled，我们也需要确保数据库状态同步
        console.log(`🔄 Updating database status to 'canceled' for user: ${userId}`);
        
        // 获取 customerId
        const customerId = typeof subscription.customer === 'string' 
          ? subscription.customer 
          : subscription.customer?.id 
          || (canceledSubscription && (typeof canceledSubscription.customer === 'string' 
            ? canceledSubscription.customer 
            : canceledSubscription.customer?.id))
          || null;
        
        await subscriptionService.updateSubscription(
          userId,
          plan, // 保持原套餐，直到 period_end
          subscriptionId,
          customerId,
          'canceled',
          periodEnd,
          lastTransactionId // 保留原有的 last_transaction_id
        );

        console.log(`✅ Subscription status updated to canceled for user: ${userId}, period ends at: ${periodEnd}`);
        
        // 验证更新是否成功
        const { data: verifyData } = await subscriptionService['table']
          .select('status')
          .eq('user_id', userId)
          .single();
        console.log(`🔍 Verified database status after update:`, verifyData?.status);
      }
    } catch (dbUpdateError: any) {
      // 即使数据库更新失败，也返回成功（因为订阅已在 Creem 端取消）
      // 记录错误但不会阻止响应
      console.error('⚠️ Failed to update database status after canceling subscription:', dbUpdateError);
      console.error('⚠️ Subscription was canceled in Creem, but local database update failed. Webhook may handle this.');
    }

    return c.json(canceledSubscription);
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return c.json(
      {
        error: 'Failed to cancel subscription',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

// ==================== Checkout Routes ====================

/**
 * POST /checkouts
 * 创建结账会话（用于创建新订阅）
 */
app.post('/checkouts', async (c) => {
  try {
    const { creem, isTestMode, creemApiKey } = getServices(c);
    const body = await c.req.json();

    if (!body.productId) {
      return c.json({ error: 'Product ID is required' }, 400);
    }

    if (!body.successUrl) {
      return c.json({ error: 'Success URL is required' }, 400);
    }

    // 从 JWT token 中解析用户信息（包括 userId 和 email）
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Authentication required. Please provide a valid authorization token.' }, 401);
    }

    const userId = user.id;
    const userEmail = user.email;

    // 确保 userId 存在（这是必需的，用于 webhook 回调时更新订阅）
    if (!userId) {
      return c.json({ error: 'User ID is required but not found in authentication token.' }, 401);
    }

    // 记录请求详情用于调试
    console.log('Creating checkout:', {
      productId: body.productId,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      userId, // 从 token 解析的 userId
      userEmail, // 从 token 解析的 user email（用于预填）
      environment: isTestMode ? 'TEST' : 'PRODUCTION',
      apiKeyPrefix: creemApiKey?.substring(0, 15) + '...',
    });

    // 先验证产品是否存在（可选，用于调试）
    try {
      const productsResponse = await creem.products.list();
      // ProductList 包含 items 数组和 pagination 信息
      const products = productsResponse.items || [];
      
      if (products.length > 0) {
        const productExists = products.some((p) => p.id === body.productId);
        console.log('Available products:', products.map((p) => ({ id: p.id, name: p.name })));
        console.log(`Product ${body.productId} exists: ${productExists}`);
        
        // 注意：如果验证失败，我们仍然尝试创建 checkout，因为 API 可能会返回更准确的错误信息
        if (!productExists && products.length > 0) {
          console.warn(`⚠️ Product ID "${body.productId}" not found in available products list, but will try to create checkout anyway`);
        }
      } else {
        console.warn('⚠️ Could not parse products list, skipping verification');
      }
    } catch (productError: any) {
      console.warn('⚠️ Could not verify product existence:', productError.message, '- will try to create checkout anyway');
    }

    // 合并传入的 metadata 和从 token 解析的 userId
    const metadata = {
      ...(body.metadata || {}),
      userId, // 确保 userId 在 metadata 中（用于 webhook 回调）
    };

    // 构建 checkout 创建参数
    const checkoutParams: any = {
      productId: body.productId,
      successUrl: body.successUrl,
      ...(body.cancelUrl && { cancelUrl: body.cancelUrl }),
      metadata,
    };

    // 如果用户有邮箱，预填到 checkout 中
    if (userEmail) {
      checkoutParams.customer = {
        email: userEmail,
      };
    }

    const checkout = await creem.checkouts.create(checkoutParams);

    console.log('✅ Checkout created successfully:', {
      checkoutId: checkout.id,
      checkoutUrl: checkout.checkoutUrl ? 'Set' : 'Not set',
    });

    return c.json({
      checkoutUrl: checkout.checkoutUrl,
      checkoutId: checkout.id,
    });
  } catch (error: any) {
    // 详细的错误日志 - 捕获所有可能的错误属性
    const errorDetails: any = {
      message: error.message,
      name: error.name,
      status: error.status,
      statusCode: error.statusCode,
      code: error.code,
    };

    // 尝试从各种可能的错误对象结构中提取信息
    if (error.response) {
      errorDetails.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
      };
    }

    if (error.cause) {
      errorDetails.cause = error.cause;
    }

    // 尝试获取所有错误对象的属性
    try {
      errorDetails.allProperties = Object.keys(error);
      errorDetails.errorString = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
    } catch (e) {
      // 忽略序列化错误
    }

    console.error('❌ Error creating checkout:', errorDetails);

    // 根据错误类型返回更详细的错误信息
    let errorMessage = error.message || 'Unknown error';
    let statusCode: 401 | 403 | 404 | 500 = 500;

    if (error.message?.includes('Forbidden') || error.status === 403 || error.statusCode === 403) {
      errorMessage = 'API 密钥无效或权限不足。请检查 CREEM_API_KEY 是否正确，以及是否具有创建结账会话的权限。';
      statusCode = 403;
    } else if (error.message?.includes('Not Found') || error.status === 404 || error.statusCode === 404) {
      // 尝试从请求中获取产品ID，如果失败则使用默认值
      let productId = 'unknown';
      try {
        const requestBody = await c.req.json() as { productId?: string };
        productId = requestBody?.productId || 'unknown';
      } catch {
        // 如果无法解析请求体，使用默认值
      }
      errorMessage = `产品 ID "${productId}" 不存在。请检查产品 ID 是否正确，以及在测试/生产环境中是否存在。`;
      statusCode = 404;
    } else if (error.message?.includes('Unauthorized') || error.status === 401 || error.statusCode === 401) {
      errorMessage = 'API 密钥未授权。请检查 CREEM_API_KEY 是否正确。';
      statusCode = 401;
    }

    return c.json(
      {
        error: 'Failed to create checkout',
        message: errorMessage,
        details: c.env.NODE_ENV === 'development' ? {
          originalError: error.message,
          status: (error as { status?: number; statusCode?: number }).status || (error as { status?: number; statusCode?: number }).statusCode,
          response: (error as { response?: { data?: unknown } }).response?.data,
        } : undefined,
      },
      statusCode
    );
  }
});

/**
 * GET /checkouts/:checkoutId
 * 获取结账会话详情
 */
app.get('/checkouts/:checkoutId', async (c) => {
  try {
    const { creem } = getServices(c);
    const checkoutId = c.req.param('checkoutId');

    if (!checkoutId) {
      return c.json({ error: 'Checkout ID is required' }, 400);
    }

    const checkout = await creem.checkouts.get({
      checkoutId,
    });

    return c.json(checkout);
  } catch (error: any) {
    console.error('Error fetching checkout:', error);
    return c.json(
      {
        error: 'Failed to fetch checkout',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /subscription/sync-from-checkout
 * 从 checkout 同步订阅状态（用于 webhook 未及时处理的情况）
 */
app.post('/subscription/sync-from-checkout', async (c) => {
  try {
    const { subscriptionService, creem, isTestMode, env } = getServices(c);
    const body = await c.req.json();
    const { checkoutId, userId } = body;

    if (!checkoutId) {
      return c.json({ error: 'Checkout ID is required' }, 400);
    }

    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400);
    }

    console.log(`🔄 Syncing subscription from checkout: ${checkoutId} for user: ${userId}`);

    // 获取 checkout 详情
    const checkout = await creem.checkouts.get({
      checkoutId,
    });

    console.log('📦 Checkout data:', {
      id: checkout.id,
      status: checkout.status,
      subscriptionId: typeof checkout.subscription === 'string' ? checkout.subscription : checkout.subscription?.id,
      customerId: typeof checkout.customer === 'string' ? checkout.customer : checkout.customer?.id,
      metadata: checkout.metadata,
    });

    // 如果 checkout 有订阅 ID，获取订阅详情
    const subscriptionId = typeof checkout.subscription === 'string' 
      ? checkout.subscription 
      : checkout.subscription?.id;
    if (subscriptionId) {
      const subscription = await creem.subscriptions.get({
        subscriptionId: typeof subscriptionId === 'string' ? subscriptionId : subscriptionId,
      });

      console.log('📦 Subscription data:', {
        id: subscription.id,
        status: subscription.status,
        customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
      });

      // 获取产品ID以确定套餐类型
      let productId: string | undefined;
      if (subscription.items && subscription.items.length > 0 && subscription.items[0].productId) {
        productId = subscription.items[0].productId;
      } else if (typeof subscription.product === 'string') {
        productId = subscription.product;
      } else if (subscription.product && typeof subscription.product === 'object' && 'id' in subscription.product) {
        productId = subscription.product.id;
      }
      
      // 如果从 subscription 中获取不到，尝试从 checkout 中获取（虽然不太可能）
      if (!productId && typeof checkout.product === 'string') {
        productId = checkout.product;
      } else if (!productId && checkout.product && typeof checkout.product === 'object' && 'id' in checkout.product) {
        productId = checkout.product.id;
      }
      
      const plan = getPlanFromProductId(productId);
      console.log('📦 Plan determined from product ID:', { productId, plan });

      // 获取 period_end（使用类型定义中的 currentPeriodEndDate）
      const periodEnd = subscription.currentPeriodEndDate 
        ? toISOString(subscription.currentPeriodEndDate)
        : null;
      
      console.log('📅 Subscription period end:', periodEnd);

      // 更新订阅状态
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        const customerId = typeof subscription.customer === 'string' 
          ? subscription.customer 
          : subscription.customer?.id 
          || (typeof checkout.customer === 'string' ? checkout.customer : checkout.customer?.id);
        
        await subscriptionService.updateSubscription(
          userId,
          plan,
          subscription.id,
          typeof customerId === 'string' ? customerId : customerId,
          'active',
          periodEnd
        );

        console.log(`✅ Subscription synced successfully for user: ${userId}`);
        return c.json({
          success: true,
          message: 'Subscription synced successfully',
          subscription: {
            id: subscription.id,
            status: subscription.status,
          },
        });
      }
    }

    return c.json({
      success: false,
      message: 'Checkout does not have an active subscription yet',
      checkout: {
        id: checkout.id,
        status: checkout.status,
      },
    });
  } catch (error: any) {
    console.error('❌ Error syncing subscription from checkout:', error);
    return c.json(
      {
        error: 'Failed to sync subscription',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

// ==================== Product Routes ====================

/**
 * GET /products
 * 获取产品列表
 */
app.get('/products', async (c) => {
  try {
    const { creem } = getServices(c);
    const products = await creem.products.list();
    return c.json(products);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return c.json(
      {
        error: 'Failed to fetch products',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /products/:productId
 * 获取单个产品详情
 */
app.get('/products/:productId', async (c) => {
  try {
    const { creem } = getServices(c);
    const productId = c.req.param('productId');

    if (!productId) {
      return c.json({ error: 'Product ID is required' }, 400);
    }

    const product = await creem.products.get({
      productId,
    });

    return c.json(product);
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return c.json(
      {
        error: 'Failed to fetch product',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

// ==================== Customer Routes ====================

/**
 * GET /customers/:customerId
 * 获取客户详情
 */
app.get('/customers/:customerId', async (c) => {
  try {
    const { creem } = getServices(c);
    const customerId = c.req.param('customerId');

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const customer = await creem.customers.get({
      customerId,
    });

    return c.json(customer);
  } catch (error: any) {
    console.error('Error fetching customer:', error);
    return c.json(
      {
        error: 'Failed to fetch customer',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /customers/:customerId/portal
 * 创建客户门户链接（用于管理订阅和支付方式）
 * Body (可选): { returnUrl?: string }
 */
app.post('/customers/:customerId/portal', async (c) => {
  try {
    const { creem } = getServices(c);
    const customerId = c.req.param('customerId');
    const body = await c.req.json().catch(() => ({}));
    const returnUrl = body.returnUrl;

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    console.log('Creating customer portal for:', {
      customerId,
      returnUrl: returnUrl || 'not provided',
    });
    
    // 如果 Creem SDK 支持 returnUrl，传递它
    const portalOptions: any = { customerId };
    if (returnUrl) {
      portalOptions.returnUrl = returnUrl;
    }
    
    const portal = await creem.customers.createPortal(portalOptions);

    console.log('Portal created successfully:', portal.customerPortalLink);

    return c.json({
      portalUrl: portal.customerPortalLink,
    });
  } catch (error: any) {
    console.error('Error creating portal link:', error);
    
    let errorMessage = error.message || 'Unknown error';
    let statusCode: 400 | 404 | 500 = 500;
    
    if (error.message?.includes('Not Found') || error.status === 404 || error.statusCode === 404) {
      statusCode = 404;
      errorMessage = 'Customer not found. Please verify the customer ID is correct.';
    } else if (error.message?.includes('Forbidden') || error.status === 403 || error.statusCode === 403) {
      statusCode = 400;
      errorMessage = 'Unable to create portal link. Please check API permissions.';
    }
    
    return c.json(
      {
        error: 'Failed to create portal link',
        message: errorMessage,
      },
      statusCode
    );
  }
});

/**
 * POST /subscription/sync-from-subscription
 * 从订阅 ID 同步订阅状态（用于客户门户返回后同步）
 * Body: { subscriptionId: string }
 */
app.post('/subscription/sync-from-subscription', async (c) => {
  try {
    const { subscriptionService, creem, isTestMode, env } = getServices(c);
    const body = await c.req.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return c.json({ error: 'Subscription ID is required' }, 400);
    }

    console.log('🔄 Syncing subscription from subscription ID:', subscriptionId);

    // 1. 从数据库查找 userId
    const { data: subscriptionData, error: queryError } = await subscriptionService['table']
      .select('user_id')
      .eq('creem_subscription_id', subscriptionId)
      .single();

    if (queryError || !subscriptionData) {
      console.error('❌ Could not find user_id for subscription:', {
        subscriptionId,
        error: queryError?.message,
      });
      return c.json(
        {
          error: 'Subscription not found in database',
          message: queryError?.message || 'No user found for this subscription',
        },
        404
      );
    }

    const userId = subscriptionData.user_id;
    console.log(`✅ Found user_id ${userId} for subscription ${subscriptionId}`);

    // 2. 获取订阅详情
    const subscription = await creem.subscriptions.get({
      subscriptionId,
    });

    // 获取订阅状态（使用类型定义中的 status）
    const subscriptionStatus = subscription.status;
    console.log('📦 Subscription status from Creem API (raw):', subscriptionStatus);
    console.log('📦 Subscription object keys:', Object.keys(subscription));
    console.log('📦 Full subscription data (first 500 chars):', JSON.stringify(subscription).substring(0, 500));
    
    // 如果状态为空或未定义，记录警告
    if (!subscription.status) {
      console.warn('⚠️ Subscription status field is missing or empty. Full subscription data:', JSON.stringify(subscription, null, 2));
    }

    // 获取 period_end（使用类型定义中的 currentPeriodEndDate）
    const periodEnd = toISOString(subscription.currentPeriodEndDate);
    
    // 获取产品ID以确定套餐类型
    let productId: string | undefined;
    if (subscription.items && subscription.items.length > 0 && subscription.items[0].productId) {
      productId = subscription.items[0].productId;
    } else if (typeof subscription.product === 'string') {
      productId = subscription.product;
    } else if (subscription.product && typeof subscription.product === 'object' && 'id' in subscription.product) {
      productId = subscription.product.id;
    }
    
    const plan = getPlanFromProductId(productId);
    
    console.log('📅 Subscription period end:', periodEnd);
    console.log('📦 Plan determined from product ID:', { productId, plan });

    // 3. 根据订阅状态更新数据库
    // 存储原始 Creem 状态；业务逻辑仍以 active/canceled/expired 做分支
    const storedStatus = subscriptionStatus || 'active';
    let logicStatus: 'active' | 'canceled' | 'expired' = 'active';
    const statusLower = (storedStatus || '').toLowerCase();
    if (statusLower === 'canceled' || statusLower === 'cancelled') {
      logicStatus = 'canceled';
      console.log('📊 Subscription status is canceled, will update database to canceled (store raw)');
    } else if (statusLower === 'expired' || statusLower === 'unpaid') {
      logicStatus = 'expired';
      console.log('📊 Subscription status is expired/unpaid, will update database to expired (store raw)');
    } else {
      // 其他状态（例如 trialing）仍按 active 逻辑处理，但存储原始值
      logicStatus = 'active';
      console.log(`📊 Subscription status "${storedStatus}" treated as active for logic, storing raw`);
    }

    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer?.id;

    await subscriptionService.updateSubscription(
      userId,
      plan,
      subscriptionId,
      customerId,
      storedStatus,
      periodEnd
    );

    console.log(`✅ Subscription synced successfully for user: ${userId}, status stored: ${storedStatus}, logicStatus: ${logicStatus}`);

    // 返回更新后的订阅状态
    const updatedStatus = await subscriptionService.getSubscriptionStatus(userId);
    return c.json({
      success: true,
      message: 'Subscription synced successfully',
      subscription: updatedStatus,
    });
  } catch (error: any) {
    console.error('❌ Error syncing subscription from subscription ID:', error);
    return c.json(
      {
        error: 'Failed to sync subscription',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

// Export default handler for Cloudflare Workers
export default app;
