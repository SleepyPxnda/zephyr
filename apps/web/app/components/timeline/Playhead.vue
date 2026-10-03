<script setup lang="ts">
/** The playhead across all lanes (prototype `.playhead`), below the sticky lane headers. */
defineProps<{ left: number }>()
</script>

<template>
  <div
    class="pointer-events-none absolute top-0 bottom-0 z-[5] -ml-px w-0.5 bg-destructive"
    :style="{ left: `${left}px` }"
    aria-hidden="true"
    data-testid="playhead"
  >
    <span class="absolute top-0 -left-[5px] border-[6px] border-transparent border-t-destructive" />
  </div>
</template>
