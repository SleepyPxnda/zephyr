<script setup lang="ts">
/** "Vor nächster Linie": + Halt (2 s) or + Pause (4 s, next line anywhere). */
defineProps<{ disabled: boolean }>()
const emit = defineEmits<{ announce: [kind: 'halt' | 'pause'] }>()
</script>

<template>
  <div class="flex flex-col items-start gap-2">
    <span class="text-sm text-muted-foreground">{{ $t('tools.beforeNextHint') }}</span>
    <div class="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        :disabled="disabled"
        data-testid="next-halt"
        @click="emit('announce', 'halt')"
      >
        {{ $t('tools.nextHalt') }}
      </Button>
      <Button
        variant="outline"
        size="sm"
        :disabled="disabled"
        data-testid="next-pause"
        @click="emit('announce', 'pause')"
      >
        {{ $t('tools.nextPause') }}
      </Button>
    </div>
  </div>
</template>
