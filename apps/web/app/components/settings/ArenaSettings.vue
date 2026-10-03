<script setup lang="ts">
import { arenaInputSchema } from '@zephyr/core'
import { Upload } from '@lucide/vue'

/** The one hall (admins): image and size in metres. Paths stay in metres when it changes. */
const { t } = useI18n()
const { data: arena, refresh } = await useArenaInfo()

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const imageId = shallowRef<string | null>(null)
const preview = shallowRef<string | null>(null)
const widthM = shallowRef<number | string>(0)
const lengthM = shallowRef<number | string>(0)
function reset() {
  imageId.value = arena.value?.imageId ?? null
  preview.value = arena.value?.imageUrl ?? null
  widthM.value = arena.value?.widthM ?? 0
  lengthM.value = arena.value?.lengthM ?? 0
}
watch(arena, reset, { immediate: true })

const input = computed(() =>
  arenaInputSchema.safeParse({
    imageId: imageId.value,
    widthM: widthM.value,
    lengthM: lengthM.value,
  }),
)
const busy = shallowRef(false)
const message = shallowRef<{ kind: 'ok' | 'error'; text: string } | null>(null)

async function upload(e: Event) {
  const el = e.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (!file) return
  message.value = null
  busy.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await $fetch<{ id: string; kind: string }>('/api/files', { method: 'POST', body })
    if (res.kind !== 'image') throw new Error('not an image')
    imageId.value = res.id
    if (preview.value?.startsWith('blob:')) URL.revokeObjectURL(preview.value)
    preview.value = URL.createObjectURL(file)
  } catch {
    message.value = { kind: 'error', text: t('arenaSettings.uploadFailed') }
  } finally {
    busy.value = false
  }
}

async function save() {
  if (!input.value.success) return
  message.value = null
  busy.value = true
  try {
    await $fetch('/api/arena', { method: 'PUT', body: input.value.data })
    await refresh()
    message.value = { kind: 'ok', text: t('settings.saved') }
  } catch {
    message.value = { kind: 'error', text: t('errors.unknown') }
  } finally {
    busy.value = false
  }
}

onBeforeUnmount(() => {
  if (preview.value?.startsWith('blob:')) URL.revokeObjectURL(preview.value)
})
</script>

<template>
  <section class="flex flex-col gap-3" aria-labelledby="arena-title">
    <h2 id="arena-title" class="text-lg font-semibold">{{ t('arenaSettings.title') }}</h2>
    <p class="text-sm text-muted-foreground">{{ t('arenaSettings.hint') }}</p>
    <p v-if="arena?.placeholder" class="text-sm text-muted-foreground">
      {{ t('arenaSettings.placeholder') }}
    </p>
    <img
      v-if="preview"
      :src="preview"
      :alt="t('arenaSettings.imageAlt')"
      class="max-h-64 w-full rounded-md border object-contain"
      data-testid="arena-preview"
    />
    <div class="flex flex-wrap items-center gap-3">
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
        data-testid="arena-file"
        @change="upload"
      />
      <Button variant="outline" :disabled="busy" @click="fileInput?.click()">
        <Upload />{{ t('arenaSettings.chooseImage') }}
      </Button>
      <span class="text-sm text-muted-foreground">{{ t('arenaSettings.imageHint') }}</span>
    </div>
    <div class="flex flex-wrap gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="arena-length">{{ t('arenaSettings.length') }}</Label>
        <Input
          id="arena-length"
          v-model.number="lengthM"
          type="number"
          min="1"
          max="500"
          step="0.1"
          class="w-32"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="arena-width">{{ t('arenaSettings.width') }}</Label>
        <Input
          id="arena-width"
          v-model.number="widthM"
          type="number"
          min="1"
          max="500"
          step="0.1"
          class="w-32"
        />
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <Button :disabled="busy || !input.success" data-testid="arena-save" @click="save">
        {{ t('settings.save') }}
      </Button>
      <Button variant="ghost" :disabled="busy" @click="reset">{{ t('settings.discard') }}</Button>
      <p
        v-if="!input.success"
        class="rounded-md bg-destructive px-2 py-1 text-sm text-destructive-foreground"
      >
        {{ t('arenaSettings.invalid') }}
      </p>
      <p
        v-else-if="message"
        :role="message.kind === 'error' ? 'alert' : 'status'"
        class="text-sm"
        :class="
          message.kind === 'error'
            ? 'rounded-md bg-destructive px-2 py-1 text-destructive-foreground'
            : 'text-muted-foreground'
        "
      >
        {{ message.text }}
      </p>
    </div>
  </section>
</template>
