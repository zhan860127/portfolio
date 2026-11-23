<script setup lang="ts">
/** 匯款帳戶資訊。內容在 app.config.ts 的 market.bank，換帳號不必動元件。 */
const appConfig = useAppConfig()
const bank = computed(() => appConfig.market?.bank)

const toast = useToast()

async function copyAccount() {
  if (!bank.value?.accountNumber) {
    return
  }

  try {
    await navigator.clipboard.writeText(bank.value.accountNumber)
    toast.add({ title: '已複製帳號', color: 'success' })
  } catch {
    toast.add({ title: '複製失敗，請手動選取帳號', color: 'warning' })
  }
}
</script>

<template>
  <div
    v-if="bank"
    class="space-y-2 rounded-lg bg-neutral-50 p-4 text-sm dark:bg-neutral-900"
  >
    <p class="text-xs tracking-wide text-neutral-500">
      匯款帳戶
    </p>
    <dl class="space-y-1.5">
      <div class="flex justify-between gap-4">
        <dt class="shrink-0 text-neutral-500">
          銀行
        </dt>
        <dd class="text-right">
          {{ bank.bankName }}<span v-if="bank.bankCode"> （{{ bank.bankCode }}）</span>
        </dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="shrink-0 text-neutral-500">
          戶名
        </dt>
        <dd class="text-right">
          {{ bank.accountName }}
        </dd>
      </div>
      <div class="flex items-center justify-between gap-4">
        <dt class="shrink-0 text-neutral-500">
          帳號
        </dt>
        <dd class="flex items-center gap-2 text-right font-mono">
          {{ bank.accountNumber || '尚未設定' }}
          <UButton
            v-if="bank.accountNumber"
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="複製帳號"
            @click="copyAccount"
          />
        </dd>
      </div>
    </dl>
    <p
      v-if="bank.note"
      class="pt-1 text-xs leading-relaxed text-neutral-500"
    >
      {{ bank.note }}
    </p>
  </div>
</template>
