<script setup lang="ts">
defineOptions({ name: 'PrivacyPolicy' })
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
        <h1 class="text-3xl font-bold mb-2">隐私政策</h1>
        <p class="text-gray-500 text-sm">最后更新日期：2024年1月1日</p>
      </div>

      <!-- Content -->
      <div class="prose prose-sm max-w-none space-y-6 text-gray-700">
        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">1. 信息收集</h2>
          <p class="mb-3">
            我们收集以下类型的信息以提供和改进我们的服务：
          </p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li><strong>账户信息：</strong>当您注册账户时，我们收集您的邮箱地址和密码（加密存储）。</li>
            <li><strong>上传的图片：</strong>您上传的服装图片和试穿图片，用于提供AI搭配推荐和虚拟试穿服务。</li>
            <li><strong>使用数据：</strong>您使用我们服务的方式，包括您的偏好设置、收藏记录和浏览历史。</li>
            <li><strong>设备信息：</strong>我们可能收集您的设备类型、操作系统和浏览器信息，以优化服务体验。</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">2. 信息使用</h2>
          <p class="mb-3">我们使用收集的信息用于以下目的：</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>提供、维护和改进我们的AI搭配推荐和虚拟试穿服务</li>
            <li>处理您的请求和交易</li>
            <li>向您发送服务相关的通知和更新</li>
            <li>分析使用情况以改进用户体验</li>
            <li>保护我们的服务安全和防止欺诈</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">3. 信息存储和安全</h2>
          <p class="mb-3">
            我们采用行业标准的安全措施来保护您的个人信息：
          </p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>所有数据传输均使用加密技术（HTTPS）</li>
            <li>密码采用安全的哈希算法存储</li>
            <li>定期进行安全审计和漏洞扫描</li>
            <li>限制员工访问个人信息的权限</li>
          </ul>
          <p class="mb-3">
            您的数据存储在安全的服务器上，我们不会将您的个人信息出售给第三方。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">4. 信息共享</h2>
          <p class="mb-3">我们不会向第三方出售、交易或转让您的个人信息，除非：</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>您明确同意我们这样做</li>
            <li>法律要求我们披露信息</li>
            <li>为了保护我们的权利、财产或安全，或保护用户或公众的权利、财产或安全</li>
            <li>与服务提供商共享（他们必须遵守严格的保密协议）</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">5. AI技术使用</h2>
          <p class="mb-3">
            我们的服务使用AI技术（包括Qwen等）来提供搭配推荐和虚拟试穿功能。您的图片数据可能被用于：
          </p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>AI模型训练和优化（在匿名化和聚合处理后）</li>
            <li>生成个性化的搭配建议</li>
            <li>创建虚拟试穿效果</li>
          </ul>
          <p class="mb-3">
            我们承诺不会将您的个人身份信息与AI训练数据关联。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">6. Cookie和追踪技术</h2>
          <p class="mb-3">
            我们使用Cookie和类似技术来：
          </p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>记住您的登录状态</li>
            <li>保存您的偏好设置</li>
            <li>分析服务使用情况</li>
          </ul>
          <p class="mb-3">
            您可以通过浏览器设置管理Cookie，但这可能影响某些功能的正常使用。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">7. 您的权利</h2>
          <p class="mb-3">您对自己的个人信息享有以下权利：</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li><strong>访问权：</strong>您可以随时查看我们持有的关于您的个人信息</li>
            <li><strong>更正权：</strong>您可以更新或更正您的个人信息</li>
            <li><strong>删除权：</strong>您可以要求删除您的账户和个人信息</li>
            <li><strong>数据可携权：</strong>您可以要求以结构化格式导出您的数据</li>
            <li><strong>撤回同意：</strong>您可以随时撤回对数据处理活动的同意</li>
          </ul>
          <p class="mb-3">
            如需行使这些权利，请通过我们的联系方式与我们联系。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">8. 数据保留</h2>
          <p class="mb-3">
            我们仅在必要期间保留您的个人信息：
          </p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>只要您的账户处于活跃状态，我们就会保留您的账户信息</li>
            <li>您上传的图片将保留到您删除账户或明确要求删除</li>
            <li>法律要求保留的数据将按照法律规定的时间保留</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">9. 儿童隐私</h2>
          <p class="mb-3">
            我们的服务不面向13岁以下的儿童。我们不会故意收集儿童的个人信息。如果我们发现收集了儿童的信息，我们将立即删除。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">10. 隐私政策变更</h2>
          <p class="mb-3">
            我们可能会不时更新本隐私政策。重大变更将通过电子邮件或网站通知的方式告知您。继续使用我们的服务即表示您接受更新后的隐私政策。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">11. 联系我们</h2>
          <p class="mb-3">
            如果您对本隐私政策有任何问题或 concerns，请通过以下方式联系我们：
          </p>
          <ul class="list-none space-y-2 mb-3">
            <li><strong>邮箱：</strong>privacy@fashion-rec.com</li>
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
