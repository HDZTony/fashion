import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createCreem } from 'creem_io';
import { createClient } from '@supabase/supabase-js';
import { SubscriptionService } from './subscription-service';
import { getPlanTypeFromProductId, PlanType, getAllPlanConfigs } from './plan-config';

// Define environment variables interface for Cloudflare Workers
interface Env {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  CREEM_TEST_MODE?: string;
  CREEM_TEST_API_KEY?: string;
  CREEM_PROD_API_KEY?: string;
  CREEM_TEST_WEBHOOK_SECRET?: string;
  CREEM_PROD_WEBHOOK_SECRET?: string;
  CREEM_TEST_PRODUCT_ID?: string;
  CREEM_PROD_PRODUCT_ID?: string;
  CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS?: string;
  CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS?: string;
  CREEM_TEST_PRODUCT_ID_PREMIUM_PRO?: string;
  CREEM_PROD_PRODUCT_ID_PREMIUM_PRO?: string;
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

/**
 * 从 Authorization header 中解析 JWT token 并获取用户信息
 * 使用 Supabase SDK 验证 token
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

    // 使用 Supabase service role key 验证 token
    // 注意：虽然这是 service role key，但可以用来验证用户 token
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.warn('Failed to get user from token:', error?.message);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
    };
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
    const { isTestMode, env } = getServices(c);
    
    // 调试信息：记录实际读取到的环境变量
    console.log('🔍 Config endpoint - Environment variables:', {
      CREEM_TEST_MODE: env.CREEM_TEST_MODE,
      isTestMode,
      CREEM_TEST_PRODUCT_ID: env.CREEM_TEST_PRODUCT_ID ? 'SET' : 'MISSING',
      CREEM_PROD_PRODUCT_ID: env.CREEM_PROD_PRODUCT_ID ? 'SET' : 'MISSING',
      CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS: env.CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS ? 'SET' : 'MISSING',
      CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS: env.CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS ? 'SET' : 'MISSING',
      CREEM_TEST_PRODUCT_ID_PREMIUM_PRO: env.CREEM_TEST_PRODUCT_ID_PREMIUM_PRO ? 'SET' : 'MISSING',
      CREEM_PROD_PRODUCT_ID_PREMIUM_PRO: env.CREEM_PROD_PRODUCT_ID_PREMIUM_PRO ? 'SET' : 'MISSING',
    });
    
    return c.json({
      isTestMode,
      environment: isTestMode ? 'TEST' : 'PRODUCTION',
      productIds: {
        premium: {
          test: env.CREEM_TEST_PRODUCT_ID,
          prod: env.CREEM_PROD_PRODUCT_ID,
        },
        premiumPlus: {
          test: env.CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS,
          prod: env.CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS,
        },
        premiumPro: {
          test: env.CREEM_TEST_PRODUCT_ID_PREMIUM_PRO,
          prod: env.CREEM_PROD_PRODUCT_ID_PREMIUM_PRO,
        },
      },
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
app.get('/plans', async (c) => {
  try {
    const allPlans = getAllPlanConfigs();
    
    // Format plans for frontend consumption
    const formattedPlans = allPlans.map((plan) => {
      // Format price
      const priceDisplay = plan.price === 0 
        ? '$0' 
        : `$${plan.price}${plan.resetPeriodDays === 30 ? ' / mo' : ''}`;
      
      // Format tries display
      let triesDisplay: string;
      if (plan.type === 'free') {
        triesDisplay = `${plan.monthlyTries}/day`;
      } else {
        triesDisplay = `${plan.monthlyTries} / month`;
      }
      
      // Format description
      let desc: string;
      switch (plan.type) {
        case 'free':
          desc = 'Core features and saved history';
          break;
        case 'premium':
          desc = 'More try-ons and priority';
          break;
        case 'premium_plus':
          desc = 'Higher limits and priority';
          break;
        case 'premium_pro':
          desc = 'Highest limits and priority';
          break;
        default:
          desc = '';
      }
      
      return {
        slug: plan.type,
        name: plan.name,
        price: priceDisplay,
        tries: triesDisplay,
        desc,
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
      // 处理不同的返回格式：可能是数组，也可能是 { data: [...] } 对象
      const productsResponseAny = productsResponse as any;
      const productsArray: any[] = Array.isArray(productsResponse as any) 
        ? (productsResponse as any) 
        : ((productsResponseAny as any).data || (productsResponseAny as any).products || []);
      
      diagnostics.apiConnection = {
        status: 'success',
        productsCount: Array.isArray(productsArray) ? productsArray.length : 0,
        products: Array.isArray(productsArray) 
          ? productsArray.slice(0, 5).map((p: any) => ({
              id: p?.id,
              name: p?.name,
            }))
          : [],
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
 * GET /subscription/status
 * 获取用户订阅状态和试穿次数信息
 * 使用 Creem SDK 通过邮箱 -> 客户ID -> 交易列表 -> 订阅ID -> 订阅信息的流程获取订阅
 * 需要 user_id 查询参数或从 Authorization header 解析
 */
app.get('/subscription/status', async (c) => {
  try {
    const { subscriptionService, creem, isTestMode, env } = getServices(c);
    // 优先从查询参数获取 user_id
    let userId = c.req.query('user_id');

    // 如果没有查询参数，尝试从 Authorization header 解析
    if (!userId) {
      const user = await getUserFromToken(c);
      if (user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return c.json({ error: 'User ID is required (use ?user_id=xxx or Authorization header)' }, 400);
    }

    // 获取用户邮箱（优先从 token 解析，否则从数据库获取）
    let userEmail: string | undefined;
    const user = await getUserFromToken(c);
    if (user?.email) {
      userEmail = user.email;
    } else {
      // 如果无法从 token 获取邮箱，尝试从数据库获取
      const { data: subscriptionData } = await subscriptionService['table']
        .select('*')
        .eq('user_id', userId)
        .single();
      // 注意：这里假设数据库中有邮箱字段，如果没有，需要从 Supabase auth 表获取
      // 暂时先使用 token 解析的方式
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
      console.log(`No Creem customer found for email ${userEmail}, returning free account status`);
      const status = await subscriptionService.getSubscriptionStatus(userId);
      return c.json(status);
    }

    const customerId = customerByEmail.id;

    // 步骤2: 通过客户ID获取交易列表
    const transactionsResponse = await creem.transactions.list({
      customerId: customerId,
    });

    // TransactionList 包含 items 数组和 pagination 信息
    const transactions = transactionsResponse.items || [];

    if (!transactions || transactions.length === 0) {
      console.log(`No transactions found for customer ${customerId}, returning free account status`);
      const status = await subscriptionService.getSubscriptionStatus(userId);
      return c.json(status);
    }

    // 步骤3: 从交易列表中找到第一个有订阅ID的交易
    // Transaction 接口中订阅ID字段是 subscription?: string
    const firstTransactionWithSubscription = transactions.find(t => t.subscription);
    
    if (!firstTransactionWithSubscription || !firstTransactionWithSubscription.subscription) {
      console.log(`No subscription ID found in transactions for customer ${customerId}`);
      const status = await subscriptionService.getSubscriptionStatus(userId);
      return c.json(status);
    }

    const subscriptionId = firstTransactionWithSubscription.subscription;

    // 步骤4: 使用订阅ID获取订阅信息
    const subscription = await creem.subscriptions.get({
      subscriptionId,
    });

    const subscriptionAny = subscription as any;

    // 从 Creem API 返回的数据中提取信息
    const creemStatus = subscriptionAny.status || 'active';
    const productId = subscriptionAny.items?.[0]?.productId 
      || subscriptionAny.items?.[0]?.product_id
      || subscriptionAny.productId 
      || subscriptionAny.product?.id;
    
    if (!productId) {
      console.error('No product ID found in Creem subscription response');
      return c.json(
        {
          error: 'Invalid subscription data',
          message: 'Subscription does not contain product information',
        },
        500
      );
    }
    
    // 获取 period_end（优先使用官方标准格式）
    const periodEnd = subscriptionAny.current_period_end_date
      || subscriptionAny.current_period_end 
      || subscriptionAny.period_end 
      || subscriptionAny.currentPeriodEndDate
      || null;

    // 根据产品ID确定计划类型
    const plan = getPlanFromProductId(productId, isTestMode, env);

    // 从数据库获取现有订阅记录（用于比较和更新）
    const { data: subscriptionData } = await subscriptionService['table']
      .select('*')
      .eq('user_id', userId)
      .single();

    // 如果计划类型、状态或周期结束时间发生变化，更新数据库
    if (!subscriptionData || 
        plan !== subscriptionData.plan || 
        creemStatus !== subscriptionData.status || 
        periodEnd !== subscriptionData.period_end) {
      console.log(`Updating subscription in database: plan=${plan}, status=${creemStatus}, periodEnd=${periodEnd}`);
      await subscriptionService.updateSubscription(
        userId,
        plan,
        subscriptionId,
        customerId,
        creemStatus === 'canceled' || creemStatus === 'cancelled' ? 'canceled' : 
        creemStatus === 'expired' || creemStatus === 'unpaid' ? 'expired' : 'active',
        periodEnd
      );
    }

    // 获取更新后的数据库状态（包含试穿次数等信息）
    const status = await subscriptionService.getSubscriptionStatus(userId);
    
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
 * 根据产品ID和环境确定套餐类型
 * 使用配置模块中的函数
 */
function getPlanFromProductId(
  productId: string | undefined,
  isTestMode: boolean,
  env: Env
): PlanType {
  return getPlanTypeFromProductId(productId, isTestMode, {
    CREEM_TEST_PRODUCT_ID: env.CREEM_TEST_PRODUCT_ID,
    CREEM_PROD_PRODUCT_ID: env.CREEM_PROD_PRODUCT_ID,
    CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS: env.CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS,
    CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS: env.CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS,
    CREEM_TEST_PRODUCT_ID_PREMIUM_PRO: env.CREEM_TEST_PRODUCT_ID_PREMIUM_PRO,
    CREEM_PROD_PRODUCT_ID_PREMIUM_PRO: env.CREEM_PROD_PRODUCT_ID_PREMIUM_PRO,
  });
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
  env: Env,
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
    
    const subscriptionAny = subscription as any;
    
    // 获取产品ID（优先使用官方标准格式）
    const productId = subscriptionAny.items?.[0]?.productId 
      || subscriptionAny.items?.[0]?.product_id
      || subscriptionAny.productId 
      || subscriptionAny.product?.id
      || eventObject.product?.id
      || eventObject.items?.[0]?.productId
      || eventObject.items?.[0]?.product_id
      || data.subscription?.items?.[0]?.productId
      || data.subscription?.productId;
    
    const plan = getPlanFromProductId(productId, isTestMode, env);
    
    // 获取 period_end（优先使用官方标准格式）
    const periodEnd = subscriptionAny.current_period_end_date
      || subscriptionAny.current_period_end 
      || subscriptionAny.period_end 
      || subscriptionAny.currentPeriodEndDate
      || eventObject.current_period_end_date
      || eventObject.current_period_end
      || data.subscription?.current_period_end
      || (subscriptionAny.periods && subscriptionAny.periods[0]?.end_date)
      || null;
    
    // 获取 customerId（优先使用官方标准格式）
    const customerId = eventObject.customer?.id 
      || subscriptionAny.customer?.id 
      || data.customer?.id;
    
    console.log(`🔄 Updating subscription for user: ${userId}`, {
      plan,
      productId,
      subscriptionId,
      customerId,
      status: targetStatus,
      periodEnd,
      eventType: data.eventType || data.type,
    });
    
    await subscriptionService.updateSubscription(
      userId,
      plan,
      subscriptionId,
      customerId,
      targetStatus,
      periodEnd
    );
    
    console.log(`✅ Subscription updated successfully for user: ${userId}`);
  } catch (error: any) {
    console.error('❌ Error updating subscription:', error);
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
      // 结账完成事件
      onCheckoutCompleted: async (data: any) => {
        console.log('✅ Checkout completed:', {
          checkoutId: data.checkout?.id,
          customerEmail: data.customer?.email,
          customerId: data.customer?.id,
          subscriptionId: data.subscription?.id,
          metadata: data.checkout?.metadata,
          fullData: JSON.stringify(data, null, 2), // 完整数据用于调试
        });

        // 尝试多种方式获取 userId
        const userId = 
          data.checkout?.metadata?.userId || 
          data.metadata?.userId || 
          data.checkout?.metadata?.user_id ||
          data.metadata?.user_id;
        
        console.log('🔍 Extracted userId:', userId);
        console.log('🔍 Available metadata paths:', {
          'data.checkout.metadata': data.checkout?.metadata,
          'data.metadata': data.metadata,
          'data.checkout': data.checkout,
        });

        if (!userId) {
          console.error('❌ No userId found in webhook data. Cannot update subscription.');
          console.error('📋 Full webhook data structure:', JSON.stringify(data, null, 2));
          return;
        }

        if (!data.subscription?.id) {
          console.error('❌ No subscription ID found in webhook data. Cannot update subscription.');
          return;
        }

        try {
          // 获取订阅详情以获取产品ID
          const subscription = await creem.subscriptions.get({
            subscriptionId: data.subscription.id,
          });
          
          // 从订阅中获取产品ID
          const subscriptionAny = subscription as any;
          const productId = subscriptionAny.items?.[0]?.productId 
            || subscriptionAny.productId 
            || subscriptionAny.product?.id
            || data.subscription?.items?.[0]?.productId
            || data.subscription?.productId;
          
          // 根据产品ID确定套餐类型
          const plan = getPlanFromProductId(productId, isTestMode, env);
          
          // 获取 period_end（可能是 current_period_end 或 period_end）
          const periodEnd = subscriptionAny.current_period_end 
            || subscriptionAny.period_end 
            || subscriptionAny.currentPeriodEndDate
            || subscriptionAny.current_period_end_date
            || data.subscription?.current_period_end
            || (subscriptionAny.periods && subscriptionAny.periods[0]?.end_date)
            || null;
          
          console.log(`🔄 Updating subscription for user: ${userId}`, {
            plan,
            productId,
            subscriptionId: data.subscription.id,
            customerId: data.customer?.id,
            status: 'active',
            periodEnd,
          });
          
            await subscriptionService.updateSubscription(
              userId,
            plan,
              data.subscription.id,
              data.customer?.id,
              'active',
              periodEnd
            );
          
          console.log(`✅ Subscription updated successfully for user: ${userId}`);
          } catch (error: any) {
            console.error('❌ Error updating subscription:', error);
          console.error('❌ Error stack:', error.stack);
        }
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
            
            const subscriptionAny = subscription as any;
            const productId = subscriptionAny.items?.[0]?.productId 
              || subscriptionAny.productId 
              || subscriptionAny.product?.id
              || context.subscription?.items?.[0]?.productId
              || context.subscription?.productId;
            
            const plan = getPlanFromProductId(productId, isTestMode, env);
            
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
            await subscriptionService.updateSubscription(
              userId,
              'free',
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

      // 订阅激活事件（根据 Creem 文档，这个事件在订阅变为 active 时触发）
      onSubscriptionActive: async (data: any) => {
        console.log('✅ Subscription active:', {
          subscriptionId: data.subscription?.id || data.object?.id || data.id,
          customerId: data.customer?.id,
          metadata: data.subscription?.metadata || data.checkout?.metadata || data.metadata,
          fullData: JSON.stringify(data, null, 2),
        });

        await handleSubscriptionEvent(
          data,
          subscriptionService,
          creem,
          isTestMode,
          env,
          'active'
        );
      },

      // 订阅试用事件
      onSubscriptionTrialing: async (data: any) => {
        console.log('🆓 Subscription trialing:', {
          subscriptionId: data.subscription?.id || data.object?.id || data.id,
          customerId: data.customer?.id,
          metadata: data.subscription?.metadata || data.checkout?.metadata || data.metadata,
          fullData: JSON.stringify(data, null, 2),
        });

        await handleSubscriptionEvent(
          data,
          subscriptionService,
          creem,
          isTestMode,
          env,
          'active'
        );
      },

      // 订阅已支付事件
      onSubscriptionPaid: async (data: any) => {
        console.log('💰 Subscription paid:', {
          subscriptionId: data.subscription?.id || data.object?.id || data.id,
          customerId: data.customer?.id,
          metadata: data.subscription?.metadata || data.checkout?.metadata || data.metadata,
        });

        await handleSubscriptionEvent(
          data,
          subscriptionService,
          creem,
          isTestMode,
          env,
          'active'
        );
      },

      // 订阅创建事件
      onSubscriptionCreated: async (data: any) => {
        console.log('📝 Subscription created:', {
          subscriptionId: data.subscription?.id || data.object?.id || data.id,
          customerId: data.customer?.id,
          productId: data.subscription?.items?.[0]?.productId,
          metadata: data.subscription?.metadata || data.checkout?.metadata || data.metadata,
          fullData: JSON.stringify(data, null, 2),
        });

        await handleSubscriptionEvent(
          data,
          subscriptionService,
          creem,
          isTestMode,
          env,
          'active'
        );
      },

      // 订阅更新事件（可能包括续费）
      onSubscriptionUpdated: async (data: any) => {
        console.log('🔄 Subscription updated:', {
          subscriptionId: data.subscription?.id,
          customerId: data.customer?.id,
        });

        // 尝试获取 userId 并更新订阅（续费时可能需要累加次数）
        const subscriptionId = data.subscription?.id || data.object?.id || data.id;
        if (!subscriptionId) {
          console.warn('⚠️ No subscription ID found in update event');
          return;
        }

        try {
          // 从数据库查找 userId
          const { data: subscriptionData, error: queryError } = await subscriptionService['table']
            .select('user_id')
            .eq('creem_subscription_id', subscriptionId)
            .single();

          if (queryError || !subscriptionData) {
            console.warn(`⚠️ Could not find user_id for subscription ${subscriptionId} in update event`);
            return;
          }

          const userId = subscriptionData.user_id;

          // 获取订阅详情
          const subscription = await creem.subscriptions.get({
            subscriptionId,
          });

          const subscriptionAny = subscription as any;
          
          // 获取产品ID以确定套餐类型
          const productId = subscriptionAny.items?.[0]?.productId 
            || subscriptionAny.productId 
            || subscriptionAny.product?.id
            || data.subscription?.items?.[0]?.productId
            || data.subscription?.productId;
          
          const plan = getPlanFromProductId(productId, isTestMode, env);
          
          // 获取 period_end
          const periodEnd = subscriptionAny.current_period_end 
            || subscriptionAny.period_end 
            || subscriptionAny.currentPeriodEndDate
            || (subscriptionAny.periods && subscriptionAny.periods[0]?.end_date)
            || null;
          
          // 获取订阅状态
          const subscriptionStatus = subscriptionAny.status || 'active';
          
          console.log(`🔄 Processing subscription update for user: ${userId}`, {
            plan,
            productId,
            subscriptionId,
            status: subscriptionStatus,
            periodEnd,
          });

          // 更新订阅（如果是续费，会自动累加次数）
          await subscriptionService.updateSubscription(
            userId,
            plan,
            subscriptionId,
            subscriptionAny.customer?.id || data.customer?.id,
            subscriptionStatus === 'active' ? 'active' : 'canceled',
            periodEnd
          );

          console.log(`✅ Subscription updated successfully for user: ${userId}`);
        } catch (error: any) {
          console.error('❌ Error processing subscription update:', error);
        }
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
          
          // 获取 period_end（可能是 current_period_end 或 period_end）
          const subscriptionAny = subscription as any;
          // 也尝试从 webhook 数据中获取 period_end
          const periodEnd = subscriptionAny.current_period_end 
            || subscriptionAny.period_end 
            || subscriptionAny.currentPeriodEndDate
            || subscriptionAny.current_period_end_date
            || data.object?.current_period_end_date
            || (subscriptionAny.periods && subscriptionAny.periods[0]?.end_date)
            || null;
          
          // 获取产品ID以确定套餐类型
          // 也尝试从 webhook 数据中获取 productId
          const productId = subscriptionAny.items?.[0]?.productId 
            || subscriptionAny.items?.[0]?.product_id
            || subscriptionAny.productId 
            || subscriptionAny.product?.id
            || data.object?.product?.id
            || data.subscription?.items?.[0]?.productId
            || data.subscription?.productId
            || data.object?.items?.[0]?.product_id;
          
          const plan = getPlanFromProductId(productId, isTestMode, env);
          
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
      onPaymentSucceeded: async (data: any) => {
        console.log('💳 Payment succeeded:', {
          transactionId: data.transaction?.id,
          amount: data.transaction?.amount,
          customerId: data.customer?.id,
        });
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

        // 尝试从数据库查找 userId
        try {
          const { data: subscriptionData, error: queryError } = await subscriptionService['table']
            .select('user_id')
            .eq('creem_subscription_id', subscriptionId)
            .single();

          if (queryError || !subscriptionData) {
            console.warn(`⚠️ Could not find user_id for expired subscription ${subscriptionId}`);
            return;
          }

          const userId = subscriptionData.user_id;

          // 降级到免费计划
          await subscriptionService.updateSubscription(
            userId,
            'free',
            null,
            null,
            'expired'
          );

          console.log(`✅ Subscription expired, downgraded user ${userId} to free plan`);
        } catch (error: any) {
          console.error('❌ Error processing subscription expired event:', error);
        }
      },

      // 订阅暂停事件（根据官方文档：subscription.paused）
      onSubscriptionPaused: async (data: any) => {
        console.log('⏸️ Subscription paused:', {
          subscriptionId: data.object?.id || data.subscription?.id || data.id,
          customerId: data.object?.customer?.id || data.customer?.id,
          eventType: data.eventType || 'subscription.paused',
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

          // 获取订阅详情以获取产品ID和 period_end
          const subscription = await creem.subscriptions.get({
            subscriptionId,
          });

          const subscriptionAny = subscription as any;
          const productId = subscriptionAny.items?.[0]?.productId 
            || subscriptionAny.productId 
            || subscriptionAny.product?.id
            || data.object?.product?.id;
          
          const plan = getPlanFromProductId(productId, isTestMode, env);
          
          const periodEnd = subscriptionAny.current_period_end_date 
            || subscriptionAny.current_period_end 
            || data.object?.current_period_end_date
            || null;

          // 保持计划但状态设为 paused（如果数据库支持）或 canceled
          // 注意：如果数据库不支持 paused 状态，可以标记为 canceled 但保留 period_end
          await subscriptionService.updateSubscription(
            userId,
            plan,
            subscriptionId,
            subscriptionAny.customer?.id || data.object?.customer?.id || data.customer?.id,
            'canceled', // 如果数据库不支持 paused，使用 canceled
            periodEnd
          );

          console.log(`✅ Subscription paused for user ${userId}, period ends at: ${periodEnd}`);
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
    });

    if (!signature) {
      console.warn('⚠️ Test webhook request missing creem-signature header');
      // 测试环境也返回 200，但记录警告
      return c.json({ received: false, error: 'Missing signature header', environment: 'test' }, 200);
    }

    if (!creemWebhookSecret) {
      console.error(`❌ ${isTestMode ? '测试' : '生产'}环境 Webhook Secret 未配置`);
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
      const currentStatus = (currentSubscription as any).status;
      
      console.log(`📋 Current subscription status: ${currentStatus}`);
      
      // 如果订阅已经是 canceled 或 expired，不需要再次取消
      if (currentStatus === 'canceled' || currentStatus === 'expired') {
        console.log(`ℹ️ Subscription is already ${currentStatus}, skipping cancel API call`);
        subscriptionAlreadyCanceled = true;
        canceledSubscription = currentSubscription;
      } else {
        // 取消订阅
        console.log(`🔄 Calling Creem API to cancel subscription: ${subscriptionId}`);
        canceledSubscription = await creem.subscriptions.cancel({
          subscriptionId,
        });
        console.log('✅ Subscription canceled in Creem:', {
          subscriptionId: canceledSubscription.id || subscriptionId,
          status: (canceledSubscription as any).status,
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

        const subscriptionAny = subscription as any;
        
        // 获取 period_end（可能是 current_period_end 或 period_end）
        const periodEnd = subscriptionAny.current_period_end 
          || subscriptionAny.period_end 
          || subscriptionAny.currentPeriodEndDate
          || (subscriptionAny.periods && subscriptionAny.periods[0]?.end_date)
          || null;
        
        // 获取产品ID以确定套餐类型
        const productId = subscriptionAny.items?.[0]?.productId 
          || subscriptionAny.productId 
          || subscriptionAny.product?.id
          || (canceledSubscription && canceledSubscription.items?.[0]?.productId)
          || (canceledSubscription && (canceledSubscription as any).productId);
        
        const plan = getPlanFromProductId(productId, isTestMode, env);
        
        console.log('📅 Subscription period end:', periodEnd);
        console.log('📦 Plan determined from product ID:', { productId, plan });

        // 3. 更新数据库状态为 canceled
        // 注意：即使订阅在 Creem 端已经是 canceled，我们也需要确保数据库状态同步
        console.log(`🔄 Updating database status to 'canceled' for user: ${userId}`);
        await subscriptionService.updateSubscription(
          userId,
          plan, // 保持原套餐，直到 period_end
          subscriptionId,
          subscriptionAny.customer?.id || (canceledSubscription && (canceledSubscription as any).customer?.id),
          'canceled',
          periodEnd
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
      // 处理不同的返回格式：可能是数组，也可能是 { data: [...] } 对象
      const productsResponseAny = productsResponse as any;
      const productsArray: any[] = Array.isArray(productsResponse as any) 
        ? (productsResponse as any) 
        : ((productsResponseAny as any).data || (productsResponseAny as any).products || []);
      
      if (Array.isArray(productsArray)) {
        const productExists = productsArray.some((p: any) => p?.id === body.productId);
        console.log('Available products:', productsArray.map((p: any) => ({ id: p?.id, name: p?.name })));
        console.log(`Product ${body.productId} exists: ${productExists}`);
        
        // 注意：如果验证失败，我们仍然尝试创建 checkout，因为 API 可能会返回更准确的错误信息
        if (!productExists && productsArray.length > 0) {
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
        const requestBody = await c.req.json();
        productId = (requestBody as any)?.productId || 'unknown';
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
          status: error.status || error.statusCode,
          response: (error as any).response?.data,
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

    const checkoutAny = checkout as any;
    console.log('📦 Checkout data:', {
      id: checkoutAny.id,
      status: checkoutAny.status,
      subscriptionId: checkoutAny.subscription?.id,
      customerId: checkoutAny.customer?.id,
      metadata: checkoutAny.metadata,
    });

    // 如果 checkout 有订阅 ID，获取订阅详情
    const subscriptionId = checkoutAny.subscription?.id || checkoutAny.subscriptionId;
    if (subscriptionId) {
      const subscription = await creem.subscriptions.get({
        subscriptionId: typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id,
      });

      const subscriptionAny = subscription as any;
      console.log('📦 Subscription data:', {
        id: subscriptionAny.id,
        status: subscriptionAny.status,
        customerId: subscriptionAny.customer?.id,
      });

      // 获取产品ID以确定套餐类型
      const productId = subscriptionAny.items?.[0]?.productId 
        || subscriptionAny.productId 
        || subscriptionAny.product?.id
        || checkoutAny.productId;
      
      const plan = getPlanFromProductId(productId, isTestMode, env);
      console.log('📦 Plan determined from product ID:', { productId, plan });

      // 获取 period_end
      const periodEnd = subscriptionAny.current_period_end 
        || subscriptionAny.period_end 
        || subscriptionAny.currentPeriodEndDate
        || (subscriptionAny.periods && subscriptionAny.periods[0]?.end_date)
        || null;
      
      console.log('📅 Subscription period end:', periodEnd);

      // 更新订阅状态
      if (subscriptionAny.status === 'active' || subscriptionAny.status === 'trialing') {
        const customerId = subscriptionAny.customer?.id || checkoutAny.customer?.id;
        await subscriptionService.updateSubscription(
          userId,
          plan,
          subscriptionAny.id,
          typeof customerId === 'string' ? customerId : customerId?.id,
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

    const subscriptionAny = subscription as any;
    
    // 获取订阅状态
    // Creem API 返回的状态字段是 status
    const subscriptionStatus = subscriptionAny.status || '';
    console.log('📦 Subscription status from Creem API (raw):', subscriptionStatus);
    console.log('📦 Subscription object keys:', Object.keys(subscriptionAny));
    console.log('📦 Full subscription data (first 500 chars):', JSON.stringify(subscriptionAny).substring(0, 500));
    
    // 如果状态为空或未定义，记录警告
    if (!subscriptionAny.status) {
      console.warn('⚠️ Subscription status field is missing or empty. Full subscription data:', JSON.stringify(subscriptionAny, null, 2));
    }

    // 获取 period_end
    const periodEnd = subscriptionAny.current_period_end 
      || subscriptionAny.period_end 
      || subscriptionAny.currentPeriodEndDate
      || (subscriptionAny.periods && subscriptionAny.periods[0]?.end_date)
      || null;
    
    // 获取产品ID以确定套餐类型
    const productId = subscriptionAny.items?.[0]?.productId 
      || subscriptionAny.productId 
      || subscriptionAny.product?.id;
    
    const plan = getPlanFromProductId(productId, isTestMode, env);
    
    console.log('📅 Subscription period end:', periodEnd);
    console.log('📦 Plan determined from product ID:', { productId, plan });

    // 3. 根据订阅状态更新数据库
    // 如果订阅已取消或过期，状态设为 canceled/expired
    // 否则设为 active
    let dbStatus: 'active' | 'canceled' | 'expired' = 'active';
    const statusLower = (subscriptionStatus || '').toLowerCase();
    if (statusLower === 'canceled' || statusLower === 'cancelled') {
      dbStatus = 'canceled';
      console.log('📊 Subscription status is canceled, will update database to canceled');
    } else if (statusLower === 'expired' || statusLower === 'unpaid') {
      dbStatus = 'expired';
      console.log('📊 Subscription status is expired/unpaid, will update database to expired');
    } else if (statusLower === 'active' || statusLower === 'trialing') {
      dbStatus = 'active';
      console.log('📊 Subscription status is active/trialing, will update database to active');
    } else {
      console.log(`📊 Unknown subscription status: "${subscriptionStatus}", defaulting to active`);
      console.log('📊 Full subscription object for debugging:', JSON.stringify(subscriptionAny, null, 2));
    }

    await subscriptionService.updateSubscription(
      userId,
      plan,
      subscriptionId,
      subscriptionAny.customer?.id,
      dbStatus,
      periodEnd
    );

    console.log(`✅ Subscription synced successfully for user: ${userId}, status: ${dbStatus}`);

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
