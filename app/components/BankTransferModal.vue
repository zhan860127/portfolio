<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal v-model:open="open" title="匯款資訊">
    <slot />

    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          請依照以下帳戶資訊完成匯款，匯款後請於訂單頁面填寫末五碼以便確認。
        </p>

        <dl class="divide-y divide-gray-200 dark:divide-gray-700">
          <div class="py-3 flex justify-between">
            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
              戶名
            </dt>
            <dd class="text-sm font-semibold text-gray-900 dark:text-white">
              詹東霖
            </dd>
          </div>
          <div class="py-3 flex justify-between">
            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
              銀行
            </dt>
            <dd class="text-sm font-semibold text-gray-900 dark:text-white">
              中國信託 (822)
            </dd>
          </div>
          <div class="py-3 flex justify-between">
            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
              帳號
            </dt>
            <dd class="text-sm font-semibold text-gray-900 dark:text-white tracking-wider">
              0000-0000-0000-0000
            </dd>
          </div>
        </dl>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton label="我知道了" color="primary" block @click="close" />
    </template>
  </UModal>
</template>
