<script setup lang="ts">
useSeoMeta({
  title: '用戶資料刪除 | 清嶼 Tranquil Island',
  description: '了解如何請求刪除您在清嶼 Tranquil Island 的個人資料。'
})

useHead({
  htmlAttrs: { lang: 'zh-TW' }
})
</script>

<template>
  <div class="py-12">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        用戶資料刪除
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-10">
        最後更新：{{ new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }) }}
      </p>

      <div class="prose prose-stone dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300">
        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            您的權利
          </h2>
          <p>
            依據個人資料保護法，您有權請求我們刪除所持有的您的個人資料。清嶼 Tranquil Island 尊重您的選擇，並提供以下方式供您行使刪除權。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            我們持有的資料類型
          </h2>
          <p>
            若您曾使用本網站，我們可能持有以下與您相關的資料：
          </p>
          <ul class="list-disc pl-6 mt-2 space-y-1">
            <li>Google 帳號資訊（姓名、電子郵件、頭像）</li>
            <li>訂單紀錄（商品、金額、收件資訊）</li>
            <li>購物車與瀏覽紀錄</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            如何請求刪除
          </h2>
          <p class="mb-4">
            請透過以下任一方式提出刪除請求：
          </p>
          <ol class="list-decimal pl-6 space-y-2">
            <li>
              <strong>Instagram 私訊</strong>：傳送訊息至
              <a
                href="https://www.instagram.com/tranquil._.island/"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-600 dark:text-primary-400 hover:underline"
              >
                @tranquil._.island
              </a>
              ，說明您希望刪除帳號相關資料。
            </li>
            <li>
              <strong>電子郵件</strong>：寄信至
              <a
                href="mailto:tranquilisland2023@gmail.com"
                class="text-primary-600 dark:text-primary-400 hover:underline"
              >
                tranquilisland2023@gmail.com
              </a>
              提出刪除請求。
            </li>
          </ol>
          <p class="mt-4">
            為確認您的身分，我們可能會請您提供與帳號相關的資訊（如註冊時使用的電子郵件），以確保資料安全。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            處理時程
          </h2>
          <p>
            我們將於收到您的請求後，於 <strong>30 個工作天內</strong> 完成處理並回覆。若因技術或法律限制無法完全刪除，我們將向您說明原因。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            例外情形
          </h2>
          <p>
            在以下情況下，我們可能依法保留部分資料：
          </p>
          <ul class="list-disc pl-6 mt-2 space-y-1">
            <li>法律規定應保存的紀錄（如交易憑證、稅務資料）</li>
            <li>進行中的爭議或訴訟所需</li>
            <li>履行契約義務所需</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            Google 登入資料
          </h2>
          <p>
            若您透過 Google 帳號登入，您亦可於
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary-600 dark:text-primary-400 hover:underline"
            >
              Google 帳戶權限設定
            </a>
            中撤銷本網站的存取權限。撤銷後，您將無法再使用 Google 登入本網站。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            Facebook 應用程式活動刪除
          </h2>
          <p class="mb-4">
            若您曾透過 Facebook 或 Instagram 登入使用清嶼相關服務，可依以下步驟自行刪除應用程式活動：
          </p>
          <ol class="list-decimal pl-6 space-y-2">
            <li>進入您的 Facebook 帳號的「設定和隱私」選單，點擊「設定」</li>
            <li>向下滾動並點擊「應用程式和網站」</li>
            <li>找到並點擊「清嶼」</li>
            <li>點擊「移除」按鈕</li>
          </ol>
          <p class="mt-4">
            即可成功地刪除您的清嶼應用程式活動。
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            聯絡我們
          </h2>
          <p>
            您遇到任何問題請立即發信至
            <a
              href="mailto:tranquilisland2023@gmail.com"
              class="text-primary-600 dark:text-primary-400 hover:underline"
            >
              tranquilisland2023@gmail.com
            </a>
          </p>
        </section>
      </div>

      <div class="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <NuxtLink
          to="/privacy"
          class="text-primary-600 dark:text-primary-400 hover:underline text-sm"
        >
          ← 返回隱私政策
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
