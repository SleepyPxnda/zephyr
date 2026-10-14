<script setup lang="ts">
/** Mouse pointer of another person in the plan, at (x, y) CSS pixels in the positioned parent. */
defineProps<{ name: string; color: string; x: number; y: number }>()
</script>

<template>
  <div
    class="pointer-events-none absolute top-0 left-0 z-20 transition-transform duration-75 ease-linear"
    :style="{ transform: `translate(${x}px, ${y}px)` }"
    aria-hidden="true"
  >
    <svg width="16" height="20" viewBox="0 0 16 20" class="drop-shadow">
      <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" :fill="color" stroke="white" />
    </svg>
    <span
      class="absolute top-4 left-3 rounded px-1.5 py-0.5 text-xs whitespace-nowrap text-white"
      :style="{ background: color }"
    >
      {{ name }}
    </span>
  </div>
</template>
