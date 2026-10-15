<script setup lang="ts">
import { isLightColor, type Horse } from '@zephyr/core'
import { EllipsisVertical } from '@lucide/vue'
import { buttonVariants } from '~/components/ui/button'

/**
 * One row in the timeline's lane header: number (in the horse colour), name, menu. A right click
 * anywhere on it opens the same entries as the ⋮ button (`HorseMenuItems`).
 */
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
const chat = useChatStore()
const toChat = () =>
  chat.attach({
    t: null,
    pos: null,
    horse: { id: props.horse.id, name: props.horse.name, k: null },
    part: null,
  })

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
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div
        class="flex h-full items-center gap-2 px-2 py-1"
        @click="emit('select')"
        @contextmenu="emit('select')"
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

        <DropdownMenu>
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
            <HorseMenuItems
              :horse="horse"
              :editable="editable"
              kind="dropdown"
              @update="emit('update', $event)"
              @ask="ask"
              @own-color="colorInput?.click()"
              @chat="toChat"
            />
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
    </ContextMenuTrigger>
    <ContextMenuContent class="w-56">
      <HorseMenuItems
        :horse="horse"
        :editable="editable"
        kind="context"
        @update="emit('update', $event)"
        @ask="ask"
        @own-color="colorInput?.click()"
        @chat="toChat"
      />
    </ContextMenuContent>
  </ContextMenu>
</template>
