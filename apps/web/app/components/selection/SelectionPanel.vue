<script setup lang="ts">
import type { Gait, GapType, MirrorMode, SelectionSummary } from '@zephyr/core'
import { RotateCcw, RotateCw, X } from '@lucide/vue'
import { buttonVariants } from '~/components/ui/button'
import { formatClock } from '~/lib/format'

/**
 * The only place to edit (SPEC "SelectionPanel"): acts on the whole selection, across horses.
 * Mixed values show as "gemischt"; buttons that cannot apply are disabled.
 */
const props = defineProps<{
  summary: SelectionSummary
  title: string
  gaits: readonly Gait[]
  editable: boolean
  canMerge: boolean
}>()
const emit = defineEmits<{
  gait: [id: string]
  tack: [value: boolean | null]
  gap: [seconds: number]
  gapType: [type: GapType]
  rotate: [degrees: number]
  mirror: [mode: MirrorMode]
  whole: []
  merge: []
  remove: []
  clear: []
}>()
const follow = defineModel<boolean>('follow', { required: true })
const multiSelect = defineModel<boolean>('multiSelect', { required: true })
const fineRotate = defineModel<boolean>('fineRotate', { required: true })

const { t, n } = useI18n()
const confirmRemove = shallowRef(false)
const dec1 = (v: number) => n(v, { maximumFractionDigits: 1, minimumFractionDigits: 1 })

const info = computed(() => {
  const s = props.summary
  const parts = [
    n(s.dist, 'metres'),
    `${formatClock(s.from, dec1)} – ${formatClock(s.to, dec1)}`,
    n(s.to - s.from, 'seconds'),
  ]
  if (s.minR !== null)
    parts.push(
      s.minR < 0.05
        ? t('selection.sharpCorner')
        : t('selection.tightest', { d: n(s.minR * 2, 'metres') }),
    )
  return parts.join(' · ')
})
const tightText = computed(() =>
  props.summary.tight > 0.05
    ? t('selection.tooTight', { m: n(props.summary.tight, 'metres') })
    : '',
)
const activeGaits = computed(() =>
  props.gaits.filter(
    (g) => !g.archivedAt || (!props.summary.gait.mixed && g.id === props.summary.gait.value),
  ),
)
const gaitValue = computed(() => (props.summary.gait.mixed ? undefined : props.summary.gait.value))
const tackValue = computed(() =>
  props.summary.tack.mixed
    ? undefined
    : props.summary.tack.value === null
      ? 'default'
      : props.summary.tack.value
        ? 'with'
        : 'without',
)
// local text of the gap field; follows the selection, applied on change (Enter or leaving the field)
const gapText = ref<string | number>('')
watch(
  () => (props.summary.gap.mixed ? '' : String(props.summary.gap.value)),
  (v) => (gapText.value = v),
  { immediate: true },
)
const gapTypeValue = computed(() =>
  props.summary.gapType && !props.summary.gapType.mixed ? props.summary.gapType.value : undefined,
)

function onGait(v: unknown) {
  if (typeof v === 'string' && v) emit('gait', v)
}
function onTack(v: unknown) {
  if (v === 'with') emit('tack', true)
  else if (v === 'without') emit('tack', false)
  else if (v === 'default') emit('tack', null)
}
function onGap() {
  const v = Number.parseFloat(String(gapText.value).replace(',', '.'))
  if (Number.isFinite(v) && v >= 0) emit('gap', Math.min(3600, v))
}
function onGapType(v: unknown) {
  if (v === 'halt' || v === 'pause') emit('gapType', v)
}
</script>

<template>
  <section
    class="flex flex-col gap-3 border-t p-3"
    :aria-label="$t('selection.label')"
    data-testid="selection-panel"
  >
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 class="font-semibold">{{ title }}</h2>
      <span class="text-sm text-muted-foreground" data-testid="selection-info">{{ info }}</span>
      <span v-if="tightText" class="text-sm font-medium" data-testid="selection-tight"
        >⚠ {{ tightText }}</span
      >
      <Button
        class="ml-auto"
        variant="ghost"
        size="icon"
        :aria-label="$t('selection.clear')"
        @click="emit('clear')"
      >
        <X />
      </Button>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label class="flex items-center gap-2 text-sm">
        {{ $t('selection.gait') }}
        <Select :model-value="gaitValue" :disabled="!editable" @update:model-value="onGait">
          <SelectTrigger class="w-36" size="sm">
            <SelectValue :placeholder="$t('selection.mixed')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="g in activeGaits" :key="g.id" :value="g.id">{{ g.name }}</SelectItem>
          </SelectContent>
        </Select>
      </label>

      <div class="flex items-center gap-2 text-sm">
        <span id="sel-tack">{{ $t('selection.tack') }}</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          :model-value="tackValue"
          :disabled="!editable"
          aria-labelledby="sel-tack"
          @update:model-value="onTack"
        >
          <ToggleGroupItem value="with">{{ $t('horse.withTack') }}</ToggleGroupItem>
          <ToggleGroupItem value="without">{{ $t('horse.withoutTack') }}</ToggleGroupItem>
          <ToggleGroupItem value="default">{{ $t('selection.tackDefault') }}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <label class="flex items-center gap-2 text-sm">
        {{ summary.onlyFirst ? $t('selection.startAt') : $t('selection.gapBefore') }}
        <Input
          v-model="gapText"
          type="number"
          class="h-8 w-24"
          min="0"
          max="3600"
          step="0.1"
          :placeholder="$t('selection.mixed')"
          :disabled="!editable"
          data-testid="selection-gap"
          @change="onGap"
        />
        s
      </label>
      <ToggleGroup
        v-if="summary.gapType"
        type="single"
        variant="outline"
        size="sm"
        :model-value="gapTypeValue"
        :disabled="!editable"
        :aria-label="$t('selection.gapType')"
        @update:model-value="onGapType"
      >
        <ToggleGroupItem value="halt">{{ $t('editor.arena.halt') }}</ToggleGroupItem>
        <ToggleGroupItem value="pause">{{ $t('editor.arena.pause') }}</ToggleGroupItem>
      </ToggleGroup>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div
        class="flex items-center gap-1 text-sm"
        role="group"
        :aria-label="$t('selection.rotate')"
      >
        <span>{{ $t('selection.rotate') }}</span>
        <Button variant="outline" size="sm" :disabled="!editable" @click="emit('rotate', -15)"
          ><RotateCcw />15°</Button
        >
        <Button variant="outline" size="sm" :disabled="!editable" @click="emit('rotate', 15)"
          ><RotateCw />15°</Button
        >
      </div>
      <div
        class="flex items-center gap-1 text-sm"
        role="group"
        :aria-label="$t('selection.mirror')"
      >
        <span>{{ $t('selection.mirror') }}</span>
        <Button variant="outline" size="sm" :disabled="!editable" @click="emit('mirror', 'hand')">{{
          $t('selection.mirrorHand')
        }}</Button>
        <Button variant="outline" size="sm" :disabled="!editable" @click="emit('mirror', 'ac')">{{
          $t('selection.mirrorLong')
        }}</Button>
        <Button variant="outline" size="sm" :disabled="!editable" @click="emit('mirror', 'eb')">{{
          $t('selection.mirrorCross')
        }}</Button>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <Checkbox
          id="sel-follow"
          :model-value="follow"
          @update:model-value="follow = $event === true"
        />
        <Label for="sel-follow">{{ $t('selection.follow') }}</Label>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" @click="emit('whole')">{{
        $t('selection.whole')
      }}</Button>
      <Button
        variant="secondary"
        size="sm"
        :disabled="!editable || !canMerge"
        @click="emit('merge')"
        >{{ $t('selection.merge') }}</Button
      >
      <Button variant="destructive" size="sm" :disabled="!editable" @click="confirmRemove = true">{{
        $t('selection.remove')
      }}</Button>
      <!-- touch: replacements for the Shift key (SPEC) -->
      <div class="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div class="flex items-center gap-2">
          <Checkbox
            id="sel-multi"
            :model-value="multiSelect"
            @update:model-value="multiSelect = $event === true"
          />
          <Label for="sel-multi">{{ $t('selection.multiSelect') }}</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            id="sel-fine"
            :model-value="fineRotate"
            @update:model-value="fineRotate = $event === true"
          />
          <Label for="sel-fine">{{ $t('selection.fineRotate') }}</Label>
        </div>
      </div>
    </div>

    <AlertDialog v-model:open="confirmRemove">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t('selection.removeTitle', summary.count) }}</AlertDialogTitle>
          <AlertDialogDescription>{{ $t('selection.removeText') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction
            :class="buttonVariants({ variant: 'destructive' })"
            @click="emit('remove')"
          >
            {{ $t('selection.remove') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
