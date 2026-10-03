<script setup lang="ts">
/** Import of a prototype plan (JSON text or .json file), with mapping of unknown gaits. */
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ imported: [id: string, musicName: string] }>()

const { t } = useI18n()
const { importPoc } = usePlans()
const { data: gaits } = useGaits()
const activeGaits = computed(() => (gaits.value ?? []).filter((g) => !g.archivedAt))

const text = shallowRef('')
const title = shallowRef('')
const error = shallowRef('')
const busy = shallowRef(false)
const unknown = shallowRef<{ names: string[]; canCreate: boolean } | null>(null)
const mapping = ref<Record<string, string>>({})
const createGaits = shallowRef(false)

watch(open, (o) => {
  if (!o) return
  text.value = ''
  title.value = ''
  error.value = ''
  unknown.value = null
  mapping.value = {}
  createGaits.value = false
})

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  text.value = await file.text()
  if (!title.value) title.value = file.name.replace(/\.json$/i, '')
}

const complete = computed(
  () => !unknown.value || createGaits.value || unknown.value.names.every((n) => mapping.value[n]),
)

async function submit() {
  error.value = ''
  let poc: unknown
  try {
    poc = JSON.parse(text.value)
  } catch {
    error.value = t('import.notJson')
    return
  }
  busy.value = true
  try {
    const res = await importPoc(poc, title.value.trim() || t('import.defaultTitle'), {
      gaitMap: unknown.value && !createGaits.value ? mapping.value : undefined,
      createGaits: createGaits.value || undefined,
    })
    if (res.ok) {
      open.value = false
      emit('imported', res.id, res.musicName)
    } else unknown.value = { names: res.unknownGaits, canCreate: res.canCreate }
  } catch {
    error.value = t('import.failed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ $t('import.title') }}</DialogTitle>
        <DialogDescription>{{ $t('import.description') }}</DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <template v-if="!unknown">
          <div class="flex flex-col gap-1.5">
            <Label for="import-file">{{ $t('import.file') }}</Label>
            <Input id="import-file" type="file" accept=".json,application/json" @change="onFile" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="import-text">{{ $t('import.text') }}</Label>
            <Textarea
              id="import-text"
              v-model="text"
              rows="6"
              class="field-sizing-fixed max-h-40 font-mono text-xs"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="import-title">{{ $t('import.planTitle') }}</Label>
            <Input id="import-title" v-model="title" maxlength="200" />
          </div>
        </template>
        <template v-else>
          <p class="text-sm">{{ $t('import.unknownGaits') }}</p>
          <div v-for="name in unknown.names" :key="name" class="flex items-center gap-3">
            <span class="w-32 truncate font-medium">{{ name }}</span>
            <Select v-model="mapping[name]" :disabled="createGaits">
              <SelectTrigger class="flex-1" :aria-label="$t('import.mapTo', { name })">
                <SelectValue :placeholder="$t('import.choose')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="g in activeGaits" :key="g.id" :value="g.id">{{
                  g.name
                }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="unknown.canCreate" class="flex items-center gap-2">
            <Checkbox
              id="import-create"
              :model-value="createGaits"
              @update:model-value="createGaits = $event === true"
            />
            <Label for="import-create">{{ $t('import.createGaits') }}</Label>
          </div>
        </template>
        <p
          v-if="error"
          role="alert"
          class="rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground"
        >
          {{ error }}
        </p>
        <DialogFooter>
          <Button type="submit" :disabled="busy || !text.trim() || !complete">
            {{ busy ? $t('auth.busy') : $t('import.submit') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
