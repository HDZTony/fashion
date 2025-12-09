<script setup lang="ts">
defineOptions({ name: 'TermsOfService' })
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4">
    <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
      <!-- Header -->
      <div class="mb-6">
        <button
          @click="router.back()"
          class="flex items-center gap-2 text-gray-600 hover:text-black transition-colors mb-4"
        >
          <ArrowLeft class="w-5 h-5" />
          <span>返回</span>
        </button>
        <h1 class="text-3xl font-bold mb-2">服务条款</h1>
        <p class="text-gray-500 text-sm">最后更新日期：2024年1月1日</p>
      </div>

      <!-- Content -->
      <div class="prose prose-sm max-w-none space-y-6 text-gray-700">
        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">1. 接受条款</h2>
          <p class="mb-3">
            欢迎使用Fashion Rec服务。通过访问或使用我们的网站和服务，您同意遵守并受本服务条款的约束。如果您不同意这些条款，请不要使用我们的服务。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">2. 服务描述</h2>
          <p class="mb-3">
            Fashion Rec是一个基于AI技术的时尚搭配推荐和虚拟试穿平台。我们提供以下服务：
          </p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>AI驱动的服装搭配推荐</li>
            <li>虚拟试穿功能</li>
            <li>个人衣橱管理</li>
            <li>时尚单品收藏和历史记录</li>
          </ul>
          <p class="mb-3">
            我们保留随时修改、暂停或终止任何服务的权利，恕不另行通知。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">3. 用户账户</h2>
          <p class="mb-3">要使用我们的服务，您需要创建一个账户。您同意：</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>提供准确、完整和最新的注册信息</li>
            <li>维护并及时更新您的账户信息</li>
            <li>对您账户下的所有活动负责</li>
            <li>立即通知我们任何未经授权的账户使用</li>
            <li>对您的密码保密，不与他人共享</li>
          </ul>
          <p class="mb-3">
            我们保留暂停或终止违反本条款的账户的权利。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">4. 用户内容</h2>
          <p class="mb-3">您上传到我们服务的所有内容（包括图片、文本等）均归您所有。通过上传内容，您授予我们：</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>使用、存储、处理和显示您的内容以提供服务的权利</li>
            <li>使用您的内容改进我们的AI模型和服务的权利（在匿名化和聚合处理后）</li>
          </ul>
          <p class="mb-3">您保证：</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>您拥有上传内容的所有必要权利</li>
            <li>您的内容不侵犯任何第三方的知识产权、隐私权或其他权利</li>
            <li>您的内容不包含非法、有害、威胁、辱骂、骚扰、诽谤、粗俗或其他令人反感的内容</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">5. 禁止行为</h2>
          <p class="mb-3">您同意不使用我们的服务：</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>用于任何非法目的或违反任何适用法律</li>
            <li>上传包含病毒、恶意软件或其他有害代码的内容</li>
            <li>尝试未经授权访问我们的系统或网络</li>
            <li>干扰或破坏服务的正常运行</li>
            <li>收集其他用户的信息</li>
            <li>冒充他人或实体</li>
            <li>进行任何可能损害我们服务的行为</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">6. AI生成内容</h2>
          <p class="mb-3">
            我们的服务使用AI技术生成搭配推荐和虚拟试穿效果。您理解并同意：
          </p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>AI生成的内容可能不完全准确或符合您的期望</li>
            <li>虚拟试穿效果仅供参考，可能与实际试穿效果存在差异</li>
            <li>我们不对AI生成内容的准确性、完整性或适用性做出任何保证</li>
            <li>您应自行判断和验证AI推荐的内容</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">7. 知识产权</h2>
          <p class="mb-3">
            我们的服务及其所有内容（包括但不限于文本、图形、徽标、图标、图像、音频剪辑、数字下载、数据编译和软件）均归我们或我们的许可方所有，并受版权、商标和其他知识产权法保护。
          </p>
          <p class="mb-3">
            未经我们明确书面许可，您不得复制、修改、分发、出售或出租我们服务的任何部分。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">8. 免责声明</h2>
          <p class="mb-3">
            我们的服务按"现状"和"可用"的基础提供。在法律允许的最大范围内，我们不对以下事项做出任何明示或暗示的保证：
          </p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>服务的准确性、可靠性或完整性</li>
            <li>服务将不间断、及时、安全或无错误</li>
            <li>通过服务获得的任何信息或建议的准确性</li>
            <li>服务将满足您的特定需求或期望</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">9. 责任限制</h2>
          <p class="mb-3">
            在法律允许的最大范围内，我们不对任何间接、偶然、特殊、后果性或惩罚性损害承担责任，包括但不限于利润损失、数据丢失、业务中断或其他无形损失，无论我们是否已被告知此类损害的可能性。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">10. 赔偿</h2>
          <p class="mb-3">
            您同意赔偿、辩护并使我们免受因以下原因引起的任何索赔、损失、责任、损害、成本和费用（包括合理的律师费）：
          </p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>您使用我们的服务</li>
            <li>您违反本服务条款</li>
            <li>您侵犯任何第三方的权利</li>
            <li>您上传的内容</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">11. 服务终止</h2>
          <p class="mb-3">
            我们保留随时终止或暂停您的账户和访问服务的权利，无论是否事先通知，原因包括但不限于：
          </p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>违反本服务条款</li>
            <li>长期不活动</li>
            <li>应法律要求</li>
            <li>其他我们认为必要的原因</li>
          </ul>
          <p class="mb-3">
            终止后，您访问服务的权利将立即停止，我们可能会删除您的账户和相关数据。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">12. 条款修改</h2>
          <p class="mb-3">
            我们保留随时修改本服务条款的权利。重大变更将通过电子邮件或网站通知的方式告知您。继续使用我们的服务即表示您接受修改后的条款。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">13. 适用法律</h2>
          <p class="mb-3">
            本服务条款受中华人民共和国法律管辖。因本条款引起的任何争议，双方应友好协商解决；协商不成的，应提交至有管辖权的人民法院解决。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">14. 联系我们</h2>
          <p class="mb-3">
            如果您对本服务条款有任何问题，请通过以下方式联系我们：
          </p>
          <ul class="list-none space-y-2 mb-3">
            <li><strong>邮箱：</strong>legal@fashion-rec.com</li>
            <li><strong>地址：</strong>[您的公司地址]</li>
          </ul>
        </section>
      </div>

      <!-- Footer -->
      <div class="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>© 2024 Fashion Rec. 保留所有权利。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose h2 {
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}

.prose ul {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.prose p {
  line-height: 1.7;
}
</style>
