<script setup lang="ts">
import { gaitsInputSchema, HORSE_COLORS, msToKmh, type GaitInput } from '@zephyr/core'
import { Plus, Trash2 } from '@lucide/vue'

/** The global gait table (admins): edit, add, archive; removed gaits in use are archived. */
const { t, n } = useI18n()
const { data: gaits, refresh } = await useGaits()

const rows = ref<GaitInput[]>([])
const reset = () =>
  (rows.value = gaits.value.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    speedTack: g.speedTack,
    speedBare: g.speedBare,
    turnDiameter: g.turnDiameter,
    archived: g.archivedAt !== null,
  })))
watch(gaits, reset, { immediate: true })

const busy = shallowRef(false)
const message = shallowRef<{ kind: 'ok' | 'error'; text: string } | null>(null)
const valid = computed(() => gaitsInputSchema.safeParse(rows.value).success)
const kmh = (ms: number) => t('gaits.kmh', { n: n(msToKmh(ms || 0), { maximumFractionDigits: 1 }) })

function add() {
  rows.value.push({
    name: t('gaits.newName'),
    color: HORSE_COLORS[rows.value.length % HORSE_COLORS.length] ?? HORSE_COLORS[0],
    speedTack: 3,
    speedBare: 3,
    turnDiameter: 4,
    archived: false,
  })
}

async function save() {
  message.value = null
  busy.value = true
  try {
    await $fetch('/api/gaits', { method: 'PUT', body: rows.value })
    await refresh()
    message.value = { kind: 'ok', text: t('settings.saved') }
  } catch {
    message.value = { kind: 'error', text: t('errors.unknown') }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-3" aria-labelledby="gaits-title">
    <h2 id="gaits-title" class="text-lg font-semibold">{{ t('gaits.title') }}</h2>
    <p class="text-sm text-muted-foreground">{{ t('gaits.hint') }}</p>
    <div class="overflow-x-auto rounded-md border">
      <table class="w-full text-sm" data-testid="gait-table">
        <thead class="text-left text-muted-foreground">
          <tr>
            <th class="px-2 py-2 font-medium">{{ t('gaits.color') }}</th>
            <th class="px-2 py-2 font-medium">{{ t('gaits.name') }}</th>
            <th class="px-2 py-2 font-medium">{{ t('gaits.speedTack') }}</th>
            <th class="px-2 py-2 font-medium">{{ t('gaits.speedBare') }}</th>
            <th class="px-2 py-2 font-medium">{{ t('gaits.turnDiameter') }}</th>
            <th class="px-2 py-2 font-medium">{{ t('gaits.archived') }}</th>
            <th class="px-2 py-2">
              <span class="sr-only">{{ t('gaits.remove') }}</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr
            v-for="(g, i) in rows"
            :key="g.id ?? `new-${i}`"
            :class="{ 'opacity-60': g.archived }"
          >
            <td class="px-2 py-1">
              <input
                v-model="g.color"
                type="color"
                class="size-8 cursor-pointer rounded border bg-transparent"
                :aria-label="t('gaits.colorOf', { name: g.name })"
              />
            </td>
            <td class="px-2 py-1">
              <Input v-model="g.name" maxlength="60" :aria-label="t('gaits.name')" />
            </td>
            <td class="px-2 py-1">
              <div class="flex items-center gap-2">
                <Input
                  v-model.number="g.speedTack"
                  type="number"
                  min="0.1"
                  max="20"
                  step="0.1"
                  class="w-20"
                  :aria-label="t('gaits.speedTack')"
                />
                <span class="text-xs whitespace-nowrap text-muted-foreground">{{
                  kmh(g.speedTack)
                }}</span>
              </div>
            </td>
            <td class="px-2 py-1">
              <div class="flex items-center gap-2">
                <Input
                  v-model.number="g.speedBare"
                  type="number"
                  min="0.1"
                  max="20"
                  step="0.1"
                  class="w-20"
                  :aria-label="t('gaits.speedBare')"
                />
                <span class="text-xs whitespace-nowrap text-muted-foreground">{{
                  kmh(g.speedBare)
                }}</span>
              </div>
            </td>
            <td class="px-2 py-1">
              <Input
                v-model.number="g.turnDiameter"
                type="number"
                min="0"
                max="100"
                step="0.5"
                class="w-20"
                :aria-label="t('gaits.turnDiameter')"
              />
            </td>
            <td class="px-2 py-1 text-center">
              <Checkbox
                :model-value="g.archived"
                :aria-label="t('gaits.archiveOf', { name: g.name })"
                @update:model-value="g.archived = $event === true"
              />
            </td>
            <td class="px-2 py-1">
              <Button
                variant="ghost"
                size="icon"
                :aria-label="t('gaits.removeOf', { name: g.name })"
                @click="rows.splice(i, 1)"
              >
                <Trash2 />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" :disabled="rows.length >= 50" @click="add">
        <Plus />{{ t('gaits.add') }}
      </Button>
      <Button :disabled="busy || !valid" data-testid="gaits-save" @click="save">
        {{ t('settings.save') }}
      </Button>
      <Button variant="ghost" :disabled="busy" @click="reset">{{ t('settings.discard') }}</Button>
      <p
        v-if="!valid"
        class="rounded-md bg-destructive px-2 py-1 text-sm text-destructive-foreground"
      >
        {{ t('gaits.invalid') }}
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
