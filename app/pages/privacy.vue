<script setup lang="ts">
useSeoMeta({
  title: '隱私政策 | 清嶼 Tranquil Island',
  description: '清嶼 Tranquil Island 隱私政策，說明我們如何收集、使用與保護您的個人資料。'
})

useHead({
  htmlAttrs: { lang: 'zh-TW' }
})
</script>

<template>
  <div class="py-12">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        隱私政策
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-10">
        最後更新：{{ new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }) }}
      </p>

      <div class="prose prose-stone dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300">
        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            一、資料收集
          </h2>
          <p>
            清嶼 Tranquil Island（以下簡稱「我們」）在您使用本網站、下單購買、訂閱電子報或與我們聯繫時，可能會收集以下資訊：
          </p>
          <ul class="list-disc pl-6 mt-2 space-y-1">
            <li>姓名、電子郵件、聯絡電話</li>
            <li>收件地址（用於寄送商品）</li>
            <li>Google 帳號資訊（若您使用 Google 登入）</li>
            <li>訂單紀錄與交易資訊</li>
            <li>瀏覽行為與裝置資訊（如 IP、瀏覽器類型）</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            二、資料使用目的
          </h2>
          <p>
            我們使用您的個人資料於以下目的：
          </p>
          <ul class="list-disc pl-6 mt-2 space-y-1">
            <li>處理訂單、寄送商品與售後服務</li>
            <li>與您聯繫（如訂單確認、出貨通知）</li>
            <li>改善網站體驗與服務品質</li>
            <li>遵守法律義務與爭議處理</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            三、資料保護
          </h2>
          <p>
            我們採取適當的技術與組織措施保護您的個人資料，防止未經授權的存取、遺失或洩漏。您的資料僅供完成服務所需之授權人員存取。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            四、Cookie 與類似技術
          </h2>
          <p>
            本網站可能使用 Cookie 及類似技術以維持登入狀態、記住購物車內容及分析網站使用情形。您可透過瀏覽器設定管理或停用 Cookie。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            五、第三方服務
          </h2>
          <p>
            我們可能使用第三方服務（如 Google、Cloudinary、Vercel）以支援網站運作、金流與影像儲存。這些服務有其各自的隱私政策，我們建議您一併查閱。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            六、您的權利
          </h2>
          <p>
            您有權查詢、閱覽、複製、補充、更正或請求刪除您的個人資料。若您希望行使上述權利，請參考我們的
            <NuxtLink to="/privacy/data-deletion" class="text-primary-600 dark:text-primary-400 hover:underline">
              用戶資料刪除說明
            </NuxtLink>
            或透過下方聯絡方式與我們聯繫。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            七、政策變更
          </h2>
          <p>
            我們可能不定期更新本隱私政策。重大變更將於本頁面公告，並註明更新日期。建議您定期查閱。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            八、聯絡我們
          </h2>
          <p>
            若您對本隱私政策有任何疑問，請透過
            <a
              href="https://www.instagram.com/tranquil._.island/"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary-600 dark:text-primary-400 hover:underline"
            >
              Instagram
            </a>
            與我們聯繫。
          </p>
        </section>
      </div>

      <div class="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <NuxtLink
          to="/privacy/data-deletion"
          class="text-primary-600 dark:text-primary-400 hover:underline text-sm"
        >
          → 用戶資料刪除說明
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
