import { createCreem } from 'creem_io';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// 加载环境变量
// 从 .dev.vars 文件加载（Cloudflare Workers 本地开发环境）
function loadEnvVars() {
  const devVarsPath = join(process.cwd(), '.dev.vars');
  
  if (existsSync(devVarsPath)) {
    try {
      const devVars = readFileSync(devVarsPath, 'utf-8');
      devVars.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            process.env[key.trim()] = value;
          }
        }
      });
      console.log('✅ 已从 .dev.vars 文件加载环境变量');
    } catch (error) {
      console.warn('⚠️  读取 .dev.vars 文件失败，将使用系统环境变量');
    }
  } else {
    console.log('ℹ️  .dev.vars 文件不存在，将使用系统环境变量');
  }
}

loadEnvVars();

// 获取环境变量
const isTestMode = process.env.CREEM_TEST_MODE === 'true';
const creemApiKey = isTestMode 
  ? process.env.CREEM_TEST_API_KEY 
  : process.env.CREEM_PROD_API_KEY;

if (!creemApiKey) {
  console.error(`❌ ${isTestMode ? '测试' : '生产'}环境 API Key 未配置`);
  console.error('请设置环境变量:');
  console.error('  - CREEM_TEST_MODE=true (或 false)');
  console.error('  - CREEM_TEST_API_KEY=your_test_api_key');
  console.error('  - CREEM_PROD_API_KEY=your_prod_api_key');
  console.error('\n或者在 .dev.vars 文件中配置这些变量');
  process.exit(1);
}

// 创建 Creem 客户端
const creem = createCreem({
  apiKey: creemApiKey,
  testMode: isTestMode,
});

interface Customer {
  id: string;
  email?: string;
  name?: string;
  [key: string]: any;
}

/**
 * 获取所有顾客信息（支持分页）
 */
async function getAllCustomers(): Promise<Customer[]> {
  const allCustomers: Customer[] = [];
  let page = 1;
  const limit = 50; // 每页获取 50 条记录
  let hasMore = true;

  console.log(`📋 开始获取所有顾客信息 (${isTestMode ? '测试' : '生产'}环境)...\n`);

  while (hasMore) {
    try {
      console.log(`正在获取第 ${page} 页 (每页 ${limit} 条)...`);
      
      const response = await creem.customers.list({
        page,
        limit,
      });

      // 根据 Creem API 类型定义，响应格式是 CustomerList
      // CustomerList = { items: Customer[], pagination: Pagination }
      const customers = response.items || [];
      const pagination = response.pagination;

      console.log(`✅ 第 ${page} 页获取成功`);
      console.log(`   顾客数量: ${customers.length}`);
      console.log(`   分页信息: 当前页 ${pagination.currentPage}/${pagination.totalPages}, 总计 ${pagination.totalRecords} 条`);

      if (customers.length === 0) {
        hasMore = false;
        console.log(`第 ${page} 页没有更多数据`);
        break;
      }

      allCustomers.push(...customers);

      // 判断是否还有更多数据
      // 使用 pagination.nextPage 来判断是否还有下一页
      if (pagination.nextPage === null) {
        hasMore = false;
        console.log(`已获取所有数据（最后一页）`);
      } else {
        page = pagination.nextPage;
      }
    } catch (error: any) {
      console.error(`❌ 获取第 ${page} 页时出错:`, error.message || error);
      throw error;
    }
  }

  return allCustomers;
}

/**
 * 获取单个顾客信息（通过 ID）
 */
async function getCustomerById(customerId: string): Promise<Customer | null> {
  try {
    console.log(`\n🔍 正在获取顾客信息 (ID: ${customerId})...`);
    const customer = await creem.customers.get({
      customerId,
    });
    return customer as Customer;
  } catch (error: any) {
    console.error(`❌ 获取顾客信息失败:`, error.message || error);
    return null;
  }
}

/**
 * 获取单个顾客信息（通过邮箱）
 */
async function getCustomerByEmail(email: string): Promise<Customer | null> {
  try {
    console.log(`\n🔍 正在获取顾客信息 (Email: ${email})...`);
    const customer = await creem.customers.get({
      email,
    });
    return customer as Customer;
  } catch (error: any) {
    console.error(`❌ 获取顾客信息失败:`, error.message || error);
    return null;
  }
}

/**
 * 创建客户门户链接
 */
async function createCustomerPortal(customerId: string): Promise<string | null> {
  try {
    console.log(`\n🔗 正在创建客户门户链接 (Customer ID: ${customerId})...`);
    const portal = await creem.customers.createPortal({
      customerId,
    });
    return portal.customerPortalLink || null;
  } catch (error: any) {
    console.error(`❌ 创建客户门户链接失败:`, error.message || error);
    return null;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 获取所有顾客
    const customers = await getAllCustomers();
    
    console.log(`\n📊 统计信息:`);
    console.log(`   总顾客数: ${customers.length}`);
    console.log(`   环境: ${isTestMode ? '测试' : '生产'}`);
    
    if (customers.length > 0) {
      console.log(`\n📋 顾客列表:`);
      customers.forEach((customer, index) => {
        console.log(`\n   [${index + 1}] 顾客 ID: ${customer.id}`);
        if (customer.email) {
          console.log(`       邮箱: ${customer.email}`);
        }
        if (customer.name) {
          console.log(`       姓名: ${customer.name}`);
        }
        // 输出其他可能存在的字段
        const otherFields = Object.keys(customer).filter(
          key => !['id', 'email', 'name'].includes(key)
        );
        if (otherFields.length > 0) {
          console.log(`       其他字段: ${otherFields.join(', ')}`);
        }
      });

      // 示例：获取第一个顾客的详细信息
      if (customers.length > 0) {
        const firstCustomer = customers[0];
        console.log(`\n\n🔍 获取第一个顾客的详细信息:`);
        const detailedCustomer = await getCustomerById(firstCustomer.id);
        if (detailedCustomer) {
          console.log(JSON.stringify(detailedCustomer, null, 2));
        }

        // 示例：创建客户门户链接
        console.log(`\n\n🔗 为第一个顾客创建门户链接:`);
        const portalLink = await createCustomerPortal(firstCustomer.id);
        if (portalLink) {
          console.log(`   门户链接: ${portalLink}`);
        }
      }
    } else {
      console.log(`\n⚠️  没有找到任何顾客记录`);
    }

    // 输出 JSON 格式（便于后续处理）
    console.log(`\n\n📄 JSON 格式输出:`);
    console.log(JSON.stringify(customers, null, 2));

  } catch (error: any) {
    console.error(`\n❌ 执行失败:`, error.message || error);
    if (error.stack) {
      console.error(`\n堆栈信息:`, error.stack);
    }
    process.exit(1);
  }
}

// 运行主函数
main();
