<script setup lang="ts">
import type { Gait, GapType, MirrorMode, SelectionSummary } from '@zephyr/core'
import { RotateCcw, RotateCw, X } from '@lucide/vue'
import { buttonVariants } from '~/components/ui/button'

/**
 * The only place to edit (SPEC "SelectionPanel"): acts on the whole selection, across horses.
 * Shown in the details sidebar beside the arena, fields stacked. Mixed values show as
 * "gemischt"; buttons that cannot apply are disabled.
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
const { seconds, clock } = useFormat()

/** section facts, one per line */
const info = computed(() => {
  const s = props.summary
  const parts = [
    `${clock(s.from)} – ${clock(s.to)}`,
    `${n(s.dist, 'metres')} · ${seconds(s.to - s.from)}`,
  ]
  if (s.minR !== null)
    parts.push(
      s.minR < 0.05
        ? t('selection.sharpCorner')
        : t('selection.tightest', { d: n(s.minR * 2, 'metres') }),
    )
  return parts
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
    class="flex flex-col gap-4 text-sm"
    :aria-label="$t('selection.label')"
    data-testid="selection-panel"
  >
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <h2 class="font-semibold">{{ title }}</h2>
        <ul class="text-muted-foreground tabular-nums" data-testid="selection-info">
          <li v-for="line in info" :key="line">{{ line }}</li>
        </ul>
        <p v-if="tightText" class="mt-1 font-medium" data-testid="selection-tight">
          ⚠ {{ tightText }}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        class="-mt-1 -mr-1 shrink-0"
        :aria-label="$t('selection.clear')"
        @click="emit('clear')"
      >
        <X />
      </Button>
    </div>

    <div class="flex flex-col gap-1.5">
      <Label for="sel-gait">{{ $t('selection.gait') }}</Label>
      <Select :model-value="gaitValue" :disabled="!editable" @update:model-value="onGait">
        <SelectTrigger id="sel-gait" class="w-full" size="sm">
          <SelectValue :placeholder="$t('selection.mixed')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="g in activeGaits" :key="g.id" :value="g.id">{{ g.name }}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="flex flex-col gap-1.5">
      <span id="sel-tack" class="font-medium">{{ $t('selection.tack') }}</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        class="w-full"
        :model-value="tackValue"
        :disabled="!editable"
        aria-labelledby="sel-tack"
        @update:model-value="onTack"
      >
        <ToggleGroupItem value="with" class="flex-1">{{ $t('horse.withTack') }}</ToggleGroupItem>
        <ToggleGroupItem value="without" class="flex-1">{{
          $t('horse.withoutTack')
        }}</ToggleGroupItem>
        <ToggleGroupItem value="default" class="flex-1">{{
          $t('selection.tackDefault')
        }}</ToggleGroupItem>
      </ToggleGroup>
    </div>

    <div class="flex flex-col gap-1.5">
      <Label for="sel-gap">{{
        summary.onlyFirst ? $t('selection.startAt') : $t('selection.gapBefore')
      }}</Label>
      <div class="flex items-center gap-2">
        <Input
          id="sel-gap"
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
        <span>s</span>
        <ToggleGroup
          v-if="summary.gapType"
          type="single"
          variant="outline"
          size="sm"
          class="ml-auto"
          :model-value="gapTypeValue"
          :disabled="!editable"
          :aria-label="$t('selection.gapType')"
          @update:model-value="onGapType"
        >
          <ToggleGroupItem value="halt">{{ $t('editor.arena.halt') }}</ToggleGroupItem>
          <ToggleGroupItem value="pause">{{ $t('editor.arena.pause') }}</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>

    <div class="flex flex-col gap-1.5" role="group" :aria-label="$t('selection.rotate')">
      <span class="font-medium">{{ $t('selection.rotate') }}</span>
      <div class="flex gap-1">
        <Button variant="outline" size="sm" :disabled="!editable" @click="emit('rotate', -15)"
          ><RotateCcw />15°</Button
        >
        <Button variant="outline" size="sm" :disabled="!editable" @click="emit('rotate', 15)"
          ><RotateCw />15°</Button
        >
      </div>
    </div>

    <div class="flex flex-col gap-1.5" role="group" :aria-label="$t('selection.mirror')">
      <span class="font-medium">{{ $t('selection.mirror') }}</span>
      <div class="flex flex-wrap gap-1">
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
      <div class="flex items-center gap-2">
        <Checkbox
          id="sel-follow"
          :model-value="follow"
          @update:model-value="follow = $event === true"
        />
        <Label for="sel-follow" class="font-normal">{{ $t('selection.follow') }}</Label>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
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
    </div>

    <!-- touch: replacements for the Shift key (SPEC) -->
    <div class="flex flex-col gap-2 border-t pt-3">
      <div class="flex items-center gap-2">
        <Checkbox
          id="sel-multi"
          :model-value="multiSelect"
          @update:model-value="multiSelect = $event === true"
        />
        <Label for="sel-multi" class="font-normal">{{ $t('selection.multiSelect') }}</Label>
      </div>
      <div class="flex items-center gap-2">
        <Checkbox
          id="sel-fine"
          :model-value="fineRotate"
          @update:model-value="fineRotate = $event === true"
        />
        <Label for="sel-fine" class="font-normal">{{ $t('selection.fineRotate') }}</Label>
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
