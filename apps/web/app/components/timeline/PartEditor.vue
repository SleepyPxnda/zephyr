<script setup lang="ts">
import { PART_COLORS, type Part, type Timing } from '@zephyr/core'
import { X } from '@lucide/vue'

/** Name, from/to and colour of one part (prototype `renderPartEd`). */
const props = defineProps<{ part: Part; timing: Timing; editable: boolean }>()
const emit = defineEmits<{
  update: [patch: Partial<Pick<Part, 'name' | 'color'>>]
  times: [start: number, end: number]
  go: []
  remove: []
  close: []
}>()

const { t } = useI18n()
const confirmRemove = shallowRef(false)

// from/to keep their own text and apply on change (Enter or leaving the field)
const fromText = ref<string | number>('')
const toText = ref<string | number>('')
watch(
  () => [props.part.start, props.part.end] as const,
  ([a, b]) => {
    fromText.value = String(Math.round(a * 100) / 100)
    toText.value = String(Math.round(b * 100) / 100)
  },
  { immediate: true },
)
const parse = (v: string | number) => Number.parseFloat(String(v).replace(',', '.'))
const applyTimes = () => emit('times', parse(fromText.value), parse(toText.value))

const { duration } = useFormat()
const length = computed(() =>
  t('timeline.parts.length', { d: duration(props.part.end - props.part.start, props.timing) }),
)
</script>

<template>
  <div class="flex flex-col gap-3 text-sm" data-testid="part-editor">
    <div class="flex items-center justify-between gap-2">
      <h3 class="font-semibold">{{ $t('timeline.parts.editor') }}</h3>
      <Button
        variant="ghost"
        size="icon"
        class="size-7"
        :aria-label="$t('common.close')"
        @click="emit('close')"
      >
        <X />
      </Button>
    </div>
    <Input
      :model-value="part.name"
      :placeholder="$t('timeline.parts.namePlaceholder')"
      :aria-label="$t('timeline.parts.name')"
      :disabled="!editable"
      maxlength="60"
      data-testid="part-name"
      @update:model-value="emit('update', { name: String($event) })"
    />
    <div class="flex items-center gap-2">
      <label class="flex items-center gap-1">
        {{ $t('timeline.parts.from') }}
        <Input
          v-model="fromText"
          type="number"
          class="h-8 w-20"
          min="0"
          step="0.1"
          :disabled="!editable"
          @change="applyTimes"
        />
      </label>
      <label class="flex items-center gap-1">
        {{ $t('timeline.parts.to') }}
        <Input
          v-model="toText"
          type="number"
          class="h-8 w-20"
          min="0"
          step="0.1"
          :disabled="!editable"
          @change="applyTimes"
        />
        s
      </label>
    </div>
    <p class="text-muted-foreground">{{ length }}</p>
    <div class="flex gap-1.5" role="group" :aria-label="$t('timeline.parts.color')">
      <button
        v-for="c in PART_COLORS"
        :key="c"
        type="button"
        class="size-6 rounded-full border border-foreground/40"
        :class="c === part.color ? 'ring-2 ring-ring ring-offset-2' : ''"
        :style="{ backgroundColor: c }"
        :aria-label="$t('timeline.parts.color')"
        :aria-pressed="c === part.color"
        :disabled="!editable"
        @click="emit('update', { color: c })"
      />
    </div>
    <div class="flex gap-2">
      <Button variant="outline" size="sm" @click="emit('go')">{{ $t('timeline.parts.go') }}</Button>
      <Button variant="destructive" size="sm" :disabled="!editable" @click="confirmRemove = true">{{
        $t('timeline.parts.remove')
      }}</Button>
    </div>
    <AlertDialog v-model:open="confirmRemove">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t('timeline.parts.removeTitle', { name: part.name })
          }}</AlertDialogTitle>
          <AlertDialogDescription>{{ $t('timeline.parts.removeText') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="emit('remove')">{{
            $t('timeline.parts.remove')
          }}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
