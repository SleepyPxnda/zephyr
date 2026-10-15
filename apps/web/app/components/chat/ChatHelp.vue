<script setup lang="ts">
import { CircleHelp } from '@lucide/vue'
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon-sm" :aria-label="$t('chat.help.open')">
        <CircleHelp />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-72 text-sm" align="end">
      <h3 class="font-semibold">{{ $t('chat.help.title') }}</h3>
      <ul class="mt-2 list-disc space-y-1.5 pl-4 text-muted-foreground">
        <li>{{ $t('chat.help.names') }}</li>
        <li>{{ $t('chat.help.menu') }}</li>
        <li>{{ $t('chat.help.keys') }}</li>
        <li>{{ $t('chat.help.send') }}</li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
