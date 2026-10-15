<script setup lang="ts">
import { HORSE_COLORS, isLightColor, type Horse } from '@zephyr/core'
import { Check, Eraser, MessageSquare, Palette, Trash2 } from '@lucide/vue'
import * as CM from '~/components/ui/context-menu'
import * as DM from '~/components/ui/dropdown-menu'

/**
 * Entries of the horse menu, shared by the ⋮ button (`DropdownMenu`) and the right click on the
 * lane header (`ContextMenu`): colour, saddle, clear, remove for editors; "An Chat senden" for all.
 */
const props = defineProps<{ horse: Horse; editable: boolean; kind: 'dropdown' | 'context' }>()
const emit = defineEmits<{
  update: [patch: Partial<Pick<Horse, 'name' | 'color' | 'tack'>>]
  ask: [action: 'clear' | 'remove']
  ownColor: []
  chat: []
}>()
const { t } = useI18n()

const ui = computed(() =>
  props.kind === 'context'
    ? {
        Item: CM.ContextMenuItem,
        Sub: CM.ContextMenuSub,
        SubTrigger: CM.ContextMenuSubTrigger,
        SubContent: CM.ContextMenuSubContent,
        Separator: CM.ContextMenuSeparator,
        Label: CM.ContextMenuLabel,
        RadioGroup: CM.ContextMenuRadioGroup,
        RadioItem: CM.ContextMenuRadioItem,
      }
    : {
        Item: DM.DropdownMenuItem,
        Sub: DM.DropdownMenuSub,
        SubTrigger: DM.DropdownMenuSubTrigger,
        SubContent: DM.DropdownMenuSubContent,
        Separator: DM.DropdownMenuSeparator,
        Label: DM.DropdownMenuLabel,
        RadioGroup: DM.DropdownMenuRadioGroup,
        RadioItem: DM.DropdownMenuRadioItem,
      },
)
const tackValue = computed(() => (props.horse.tack ? 'with' : 'without'))
const sameColor = (c: string) => c.toUpperCase() === props.horse.color.toUpperCase()
function setTack(v: unknown) {
  if (v === 'with' || v === 'without') emit('update', { tack: v === 'with' })
}
</script>

<template>
  <template v-if="editable">
    <component :is="ui.Sub">
      <component :is="ui.SubTrigger">
        <Palette class="size-4 text-muted-foreground" />
        {{ t('horse.colorMenu') }}
        <span
          class="ml-auto size-3.5 rounded-full border border-foreground/60"
          :style="{ backgroundColor: horse.color }"
          aria-hidden="true"
        />
      </component>
      <component :is="ui.SubContent" class="p-2">
        <div class="grid grid-cols-5 gap-1" role="group" :aria-label="t('horse.colorChoice')">
          <component
            :is="ui.Item"
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
          </component>
        </div>
        <component :is="ui.Separator" />
        <component :is="ui.Item" @select="emit('ownColor')">{{ t('horse.ownColor') }} …</component>
      </component>
    </component>
    <component :is="ui.Separator" />
    <component :is="ui.Label" class="text-xs font-normal text-muted-foreground">{{
      t('horse.tackDefault')
    }}</component>
    <component :is="ui.RadioGroup" :model-value="tackValue" @update:model-value="setTack">
      <component :is="ui.RadioItem" value="with">{{ t('horse.withTack') }}</component>
      <component :is="ui.RadioItem" value="without">{{ t('horse.withoutTackShort') }}</component>
    </component>
    <component :is="ui.Separator" />
    <component :is="ui.Item" :disabled="!horse.path.pts.length" @select="emit('ask', 'clear')">
      <Eraser />
      {{ t('horse.clear') }}
    </component>
    <component :is="ui.Item" variant="destructive" @select="emit('ask', 'remove')">
      <Trash2 />
      {{ t('horse.remove') }}
    </component>
    <component :is="ui.Separator" />
  </template>
  <component :is="ui.Item" data-testid="horse-chat" @select="emit('chat')">
    <MessageSquare />
    {{ t('chat.menu.sendSpot') }}
  </component>
</template>
