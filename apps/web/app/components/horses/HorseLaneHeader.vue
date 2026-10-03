<script setup lang="ts">
import { HORSE_COLORS, isLightColor, type Horse } from '@zephyr/core'
import { EllipsisVertical } from '@lucide/vue'
import { buttonVariants } from '~/components/ui/button'

const props = defineProps<{ horse: Horse; active: boolean; editable: boolean }>()
const emit = defineEmits<{
  select: []
  selectWhole: []
  update: [patch: Partial<Pick<Horse, 'name' | 'color' | 'tack'>>]
  clear: []
  remove: []
}>()

const { t } = useI18n()
// the dialog closes before its action runs, so "open" and the chosen action are kept apart
const confirmOpen = shallowRef(false)
const confirm = shallowRef<'clear' | 'remove'>('remove')
const ask = (action: 'clear' | 'remove') => {
  confirm.value = action
  confirmOpen.value = true
}
const numberClass = computed(() =>
  isLightColor(props.horse.color) ? 'text-foreground' : 'text-white',
)
const tackValue = computed(() => (props.horse.tack ? 'with' : 'without'))

function setTack(v: unknown) {
  if (v === 'with' || v === 'without') emit('update', { tack: v === 'with' })
}
function onColor(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (/^#[0-9a-f]{6}$/i.test(v)) emit('update', { color: v })
}
function runConfirmed() {
  if (confirm.value === 'clear') emit('clear')
  else emit('remove')
}
</script>

<template>
  <!-- two rows in the timeline's lane header: number, colour, name, menu · saddle -->
  <div class="flex h-full flex-col justify-center gap-1 px-2 py-1.5" @click="emit('select')">
    <div class="flex items-center gap-2">
      <!-- SPEC: a click on the horse number selects the whole path -->
      <button
        type="button"
        class="flex size-8 shrink-0 items-center justify-center rounded-full border border-foreground/60 text-sm font-bold"
        :class="numberClass"
        :style="{ backgroundColor: horse.color }"
        :aria-label="t('horse.selectWhole', { number: horse.number })"
        :data-testid="`horse-number-${horse.number}`"
        @click.stop="emit('selectWhole')"
      >
        {{ horse.number }}
      </button>
      <Popover>
        <PopoverTrigger as-child>
          <button
            type="button"
            class="size-5 shrink-0 rounded-sm border border-foreground/60"
            :style="{ backgroundColor: horse.color }"
            :aria-label="t('horse.color', { number: horse.number })"
            :disabled="!editable"
          />
        </PopoverTrigger>
        <PopoverContent class="w-auto">
          <div class="grid grid-cols-5 gap-2" role="group" :aria-label="t('horse.colorChoice')">
            <button
              v-for="c in HORSE_COLORS"
              :key="c"
              type="button"
              class="size-7 rounded-full border border-foreground/60"
              :class="
                c.toUpperCase() === horse.color.toUpperCase()
                  ? 'ring-2 ring-ring ring-offset-2'
                  : ''
              "
              :style="{ backgroundColor: c }"
              :aria-label="c"
              :aria-pressed="c.toUpperCase() === horse.color.toUpperCase()"
              @click="emit('update', { color: c })"
            />
          </div>
          <Label class="mt-3 flex items-center gap-2 text-sm">
            {{ t('horse.ownColor') }}
            <input
              type="color"
              :value="horse.color"
              class="h-7 w-10 cursor-pointer"
              @change="onColor"
            />
          </Label>
        </PopoverContent>
      </Popover>

      <Input
        :model-value="horse.name"
        class="h-8 min-w-0 flex-1 border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input"
        :aria-label="t('horse.name', { number: horse.number })"
        :placeholder="t('horse.namePlaceholder')"
        :disabled="!editable"
        maxlength="60"
        @update:model-value="emit('update', { name: String($event) })"
      />

      <DropdownMenu v-if="editable">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" :aria-label="t('horse.actions')"
            ><EllipsisVertical
          /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem :disabled="!horse.path.pts.length" @select="ask('clear')">
            {{ t('horse.clear') }}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" @select="ask('remove')">{{
            t('horse.remove')
          }}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div class="flex items-center gap-2 pl-10">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        :model-value="tackValue"
        :disabled="!editable"
        :aria-label="t('horse.tack')"
        @update:model-value="setTack"
      >
        <ToggleGroupItem value="with">{{ t('horse.withTack') }}</ToggleGroupItem>
        <ToggleGroupItem value="without">{{ t('horse.withoutTack') }}</ToggleGroupItem>
      </ToggleGroup>
    </div>

    <AlertDialog v-model:open="confirmOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            t(confirm === 'remove' ? 'horse.removeTitle' : 'horse.clearTitle', {
              name: horse.name || horse.number,
            })
          }}</AlertDialogTitle>
          <AlertDialogDescription>{{
            t(confirm === 'remove' ? 'horse.removeText' : 'horse.clearText')
          }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction
            :class="buttonVariants({ variant: 'destructive' })"
            @click="runConfirmed"
          >
            {{ t(confirm === 'remove' ? 'horse.remove' : 'horse.clear') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
