<script setup lang="ts">
import { HORSE_COLORS, isLightColor, type Horse } from '@zephyr/core'
import { Check, EllipsisVertical, Eraser, Palette, Trash2 } from '@lucide/vue'
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
const sameColor = (c: string) => c.toUpperCase() === props.horse.color.toUpperCase()

// the menu opens from its button or by a right click anywhere on the header
const menuOpen = shallowRef(false)
function onContextMenu(e: MouseEvent) {
  if (!props.editable) return
  e.preventDefault()
  emit('select')
  menuOpen.value = true
}

function setTack(v: unknown) {
  if (v === 'with' || v === 'without') emit('update', { tack: v === 'with' })
}
const colorInput = useTemplateRef<HTMLInputElement>('colorInput')
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
  <!-- one row in the timeline's lane header: number (in the horse colour), name, menu -->
  <div
    class="flex h-full items-center gap-2 px-2 py-1"
    @click="emit('select')"
    @contextmenu="onContextMenu"
  >
    <!-- SPEC: a click on the horse number selects the whole path -->
    <button
      type="button"
      class="flex size-7 shrink-0 items-center justify-center rounded-full border border-foreground/60 text-sm font-bold"
      :class="numberClass"
      :style="{ backgroundColor: horse.color }"
      :aria-label="t('horse.selectWhole', { number: horse.number })"
      :title="t('horse.selectWhole', { number: horse.number })"
      :data-testid="`horse-number-${horse.number}`"
      @click.stop="emit('selectWhole')"
    >
      {{ horse.number }}
    </button>

    <Input
      :model-value="horse.name"
      class="h-8 min-w-0 flex-1 border-transparent bg-transparent px-1.5 shadow-none hover:border-input focus-visible:border-input"
      :aria-label="t('horse.name', { number: horse.number })"
      :placeholder="t('horse.defaultName', { number: horse.number })"
      :disabled="!editable"
      maxlength="60"
      @update:model-value="emit('update', { name: String($event) })"
    />

    <!-- the default is "with saddle": only the exception is shown -->
    <Badge
      v-if="!horse.tack"
      variant="outline"
      class="text-muted-foreground"
      data-testid="horse-without-tack"
      >{{ t('horse.withoutTackShort') }}</Badge
    >

    <DropdownMenu v-if="editable" v-model:open="menuOpen">
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          class="size-7"
          :aria-label="t('horse.actions')"
          :data-testid="`horse-menu-${horse.number}`"
          @click.stop
          ><EllipsisVertical
        /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-56">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette class="size-4 text-muted-foreground" />
            {{ t('horse.colorMenu') }}
            <span
              class="ml-auto size-3.5 rounded-full border border-foreground/60"
              :style="{ backgroundColor: horse.color }"
              aria-hidden="true"
            />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="p-2">
            <div class="grid grid-cols-5 gap-1" role="group" :aria-label="t('horse.colorChoice')">
              <DropdownMenuItem
                v-for="c in HORSE_COLORS"
                :key="c"
                class="size-8 justify-center p-0"
                :aria-label="c"
                :aria-checked="sameColor(c)"
                @select="emit('update', { color: c })"
              >
                <span
                  class="flex size-6 items-center justify-center rounded-full border border-foreground/60"
                  :style="{ backgroundColor: c }"
                >
                  <Check
                    v-if="sameColor(c)"
                    class="size-3.5"
                    :class="isLightColor(c) ? 'text-foreground!' : 'text-white!'"
                  />
                </span>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="colorInput?.click()"
              >{{ t('horse.ownColor') }} …</DropdownMenuItem
            >
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">{{
          t('horse.tackDefault')
        }}</DropdownMenuLabel>
        <DropdownMenuRadioGroup :model-value="tackValue" @update:model-value="setTack">
          <DropdownMenuRadioItem value="with">{{ t('horse.withTack') }}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="without">{{
            t('horse.withoutTackShort')
          }}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem :disabled="!horse.path.pts.length" @select="ask('clear')">
          <Eraser />
          {{ t('horse.clear') }}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" @select="ask('remove')">
          <Trash2 />
          {{ t('horse.remove') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <input
      v-if="editable"
      ref="colorInput"
      type="color"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      :value="horse.color"
      @change="onColor"
    />

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
