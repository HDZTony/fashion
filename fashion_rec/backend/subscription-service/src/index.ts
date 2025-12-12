import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createCreem } from 'creem_io';
import { SubscriptionService } from './subscription-service';

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
 * 需要 user_id 查询参数或从 Authorization header 解析
 */
app.get('/subscription/status', async (c) => {
  try {
    const { subscriptionService } = getServices(c);
    // 优先从查询参数获取 user_id
    let userId = c.req.query('user_id');

    // 如果没有查询参数，尝试从 Authorization header 解析
    // 注意：这里简化处理，实际应该解析 JWT token 获取 user_id
    if (!userId) {
      const authHeader = c.req.header('Authorization');
      if (authHeader) {
        // 如果前端传递的是 user_id（开发环境），直接使用
        // 生产环境应该解析 JWT token
        userId = authHeader.replace('Bearer ', '');
      }
    }

    if (!userId) {
      return c.json({ error: 'User ID is required (use ?user_id=xxx or Authorization header)' }, 400);
    }

    const status = await subscriptionService.getSubscriptionStatus(userId);
    return c.json(status);
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
 */
function getPlanFromProductId(
  productId: string | undefined,
  isTestMode: boolean,
  env: Env
): 'premium' | 'premium_plus' {
  const premiumPlusIds = [
    // 优先使用环境变量
    isTestMode ? env.CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS : env.CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS,
    // 兼容旧变量
    env.CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS,
    env.CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS,
    // 默认测试产品ID（已知）
    isTestMode ? 'prod_6YsIDqxb9lnMmVarSuUfBc' : undefined,
  ].filter(Boolean);

  if (productId && premiumPlusIds.includes(productId)) {
    return 'premium_plus';
  }

  // 兜底为 premium
  return 'premium';
}

// ==================== Webhook Routes ====================

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
          
          console.log(`🔄 Updating subscription for user: ${userId}`, {
            plan,
            productId,
            subscriptionId: data.subscription.id,
            customerId: data.customer?.id,
            status: 'active',
          });
          
            await subscriptionService.updateSubscription(
              userId,
            plan,
              data.subscription.id,
              data.customer?.id,
              'active'
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

      // 订阅创建事件
      onSubscriptionCreated: async (data: any) => {
        console.log('📝 Subscription created:', {
          subscriptionId: data.subscription?.id,
          customerId: data.customer?.id,
          productId: data.subscription?.items?.[0]?.productId,
        });
      },

      // 订阅更新事件
      onSubscriptionUpdated: async (data: any) => {
        console.log('🔄 Subscription updated:', {
          subscriptionId: data.subscription?.id,
          customerId: data.customer?.id,
        });
      },

      // 订阅取消事件
      onSubscriptionCanceled: async (data: any) => {
        console.log('❌ Subscription canceled:', {
          subscriptionId: data.subscription?.id,
          customerId: data.customer?.id,
        });

        // 查找并更新订阅状态
        // 注意：这里需要从 subscription_id 查找 user_id，可能需要额外的查询
        // 或者从 metadata 中获取
        const userId = data.metadata?.userId;
        if (userId && data.subscription?.id) {
          try {
            // 获取订阅详情以获取 period_end
            const subscription = await creem.subscriptions.get({
              subscriptionId: data.subscription.id,
            });
            
            // 获取 period_end（可能是 current_period_end 或 period_end）
            const subscriptionAny = subscription as any;
            const periodEnd = subscriptionAny.current_period_end 
              || subscriptionAny.period_end 
              || (subscriptionAny.currentPeriodEndDate)
              || (subscriptionAny.periods && subscriptionAny.periods[0]?.end_date)
              || null;
            
            // 获取产品ID以确定套餐类型
            const productId = subscriptionAny.items?.[0]?.productId 
              || subscriptionAny.productId 
              || subscriptionAny.product?.id
              || data.subscription?.items?.[0]?.productId
              || data.subscription?.productId;
            
            const plan = getPlanFromProductId(productId, isTestMode, env);
            
            console.log('📅 Subscription period end:', periodEnd);
            console.log('📦 Plan determined from product ID:', { productId, plan });
            
            // 保持原套餐，但状态设为 canceled，并保存 period_end
            // 这样用户可以在剩余时间内继续使用高级功能
            await subscriptionService.updateSubscription(
              userId,
              plan, // 保持原套餐，直到 period_end
              data.subscription?.id,
              data.customer?.id,
              'canceled',
              periodEnd
            );
            console.log(`✅ Subscription canceled for user: ${userId}, period ends at: ${periodEnd}`);
          } catch (error: any) {
            console.error('❌ Error canceling subscription:', error);
          }
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
  };
};

/**
 * POST /webhook
 * 处理 Creem.io webhook 事件（生产环境）
 * Webhook URL: https://fashion.hdz73.com/webhook
 */
app.post('/webhook', async (c) => {
  try {
    const { subscriptionService, creem, isTestMode, creemWebhookSecret } = getServices(c);
    // 获取原始请求体（字符串格式）
    const rawBody = await c.req.text();
    
    // 获取签名头
    const signature = c.req.header('creem-signature');

    console.log('🌐 Production webhook received:', {
      hasBody: !!rawBody,
      bodyLength: rawBody?.length || 0,
      hasSignature: !!signature,
    });

    if (!signature) {
      console.warn('⚠️ Webhook request missing creem-signature header');
      return c.json({ error: 'Missing signature header' }, 400);
    }

    if (!creemWebhookSecret) {
      console.error(`❌ ${isTestMode ? '测试' : '生产'}环境 Webhook Secret 未配置`);
      return c.json({ error: 'Webhook secret not configured' }, 500);
    }

    // 使用 Creem SDK 处理 webhook 事件（自动验证签名）
    await creem.webhooks.handleEvents(rawBody, signature, createWebhookHandler(subscriptionService, creem, isTestMode, c.env));

    return c.json({ received: true });
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    
    // 如果是签名验证失败，返回 401
    if (error.message?.includes('signature') || error.message?.includes('verification')) {
      return c.json(
        {
          error: 'Invalid webhook signature',
          message: error.message,
        },
        401
      );
    }

    return c.json(
      {
        error: 'Webhook processing failed',
        message: error.message || 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /test-webhook
 * 处理 Creem.io webhook 事件（测试环境）
 * Webhook URL: https://fashion.hdz73.com/test-webhook
 */
app.post('/test-webhook', async (c) => {
  try {
    const { subscriptionService, creem, isTestMode, creemWebhookSecret } = getServices(c);
    // 获取原始请求体（字符串格式）
    const rawBody = await c.req.text();
    
    // 获取签名头
    const signature = c.req.header('creem-signature');

    console.log('🧪 Test webhook received:', {
      hasBody: !!rawBody,
      bodyLength: rawBody?.length || 0,
      hasSignature: !!signature,
      headers: Object.keys(c.req.raw.headers),
    });

    if (!signature) {
      console.warn('⚠️ Test webhook request missing creem-signature header');
      return c.json({ error: 'Missing signature header' }, 400);
    }

    if (!creemWebhookSecret) {
      console.error(`❌ ${isTestMode ? '测试' : '生产'}环境 Webhook Secret 未配置`);
      return c.json({ error: 'Webhook secret not configured' }, 500);
    }

    // 尝试解析请求体（用于调试）
    try {
      const parsedBody = JSON.parse(rawBody);
      console.log('📦 Webhook event type:', parsedBody.type || parsedBody.event || 'unknown');
      console.log('📦 Webhook data structure:', {
        hasCheckout: !!parsedBody.checkout,
        hasCustomer: !!parsedBody.customer,
        hasSubscription: !!parsedBody.subscription,
        checkoutMetadata: parsedBody.checkout?.metadata,
      });
    } catch (e) {
      console.warn('⚠️ Could not parse webhook body as JSON');
    }
    
    // 使用 Creem SDK 处理 webhook 事件（自动验证签名）
    await creem.webhooks.handleEvents(rawBody, signature, createWebhookHandler(subscriptionService, creem, isTestMode, c.env));

    return c.json({ received: true, environment: 'test' });
  } catch (error: any) {
    console.error('❌ Test webhook processing error:', error);
    
    // 如果是签名验证失败，返回 401
    if (error.message?.includes('signature') || error.message?.includes('verification')) {
      return c.json(
        {
          error: 'Invalid webhook signature',
          message: error.message,
        },
        401
      );
    }

    return c.json(
      {
        error: 'Test webhook processing failed',
        message: error.message || 'Unknown error',
      },
      500
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
      updateBehavior: body.updateBehavior || 'proration-charge-immediately',
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
      updateBehavior: body.updateBehavior || 'proration-charge-immediately',
    });

    const upgradedSubscription = await creem.subscriptions.upgrade({
      subscriptionId,
      productId: body.productId,
      updateBehavior: body.updateBehavior || 'proration-charge-immediately',
    });

    console.log('Subscription upgraded successfully:', upgradedSubscription);
    return c.json(upgradedSubscription);
  } catch (error: any) {
    console.error('Error upgrading subscription:', error);
    
    // Provide more detailed error information
    let errorMessage = error.message || 'Unknown error';
    let statusCode: 403 | 404 | 500 = 500;
    
    if (error.message?.includes('Forbidden') || error.status === 403 || error.statusCode === 403) {
      statusCode = 403;
      errorMessage = 'Upgrade/downgrade operation is not permitted. This may be due to API permissions or subscription restrictions. Please use the customer portal to manage your subscription.';
    } else if (error.message?.includes('Not Found') || error.status === 404 || error.statusCode === 404) {
      statusCode = 404;
      errorMessage = `Subscription or product not found. Please verify the subscription ID and product ID are correct.`;
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
    const { creem } = getServices(c);
    const subscriptionId = c.req.param('subscriptionId');

    if (!subscriptionId) {
      return c.json({ error: 'Subscription ID is required' }, 400);
    }

    const canceledSubscription = await creem.subscriptions.cancel({
      subscriptionId,
    });

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

    // 记录请求详情用于调试
    console.log('Creating checkout:', {
      productId: body.productId,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      metadata: body.metadata,
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

    const checkout = await creem.checkouts.create({
      productId: body.productId,
      successUrl: body.successUrl,
      ...(body.cancelUrl && { cancelUrl: body.cancelUrl }),
      metadata: body.metadata || {},
    } as any);

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
 */
app.post('/customers/:customerId/portal', async (c) => {
  try {
    const { creem } = getServices(c);
    const customerId = c.req.param('customerId');

    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    console.log('Creating customer portal for:', customerId);
    
    const portal = await creem.customers.createPortal({
      customerId,
    });

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

// Export default handler for Cloudflare Workers
export default app;
