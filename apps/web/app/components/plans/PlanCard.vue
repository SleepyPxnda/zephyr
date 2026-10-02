<script setup lang="ts">
import { EllipsisVertical } from '@lucide/vue'
import { buttonVariants } from '~/components/ui/button'
import type { PlanListItem } from '~/composables/usePlans'

const props = defineProps<{ plan: PlanListItem }>()
const emit = defineEmits<{ duplicate: []; remove: [] }>()
const { d } = useI18n()
const confirmRemove = shallowRef(false)
const updated = computed(() => d(new Date(props.plan.updatedAt), 'short'))
</script>

<template>
  <Card class="gap-3 py-4">
    <CardHeader class="flex flex-row items-start justify-between gap-2 px-4">
      <div class="min-w-0">
        <NuxtLink
          :to="`/plans/${plan.id}`"
          class="block truncate font-semibold hover:underline"
          data-testid="plan-link"
        >
          {{ plan.title }}
        </NuxtLink>
        <p class="text-sm text-muted-foreground">{{ $t('plans.updated', { date: updated }) }}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            :aria-label="$t('plans.actions', { title: plan.title })"
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @select="emit('duplicate')">{{
            $t('plans.duplicate')
          }}</DropdownMenuItem>
          <DropdownMenuItem
            v-if="plan.role === 'owner'"
            variant="destructive"
            @select="confirmRemove = true"
          >
            {{ $t('plans.remove') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <CardContent class="px-4">
      <Badge variant="secondary">{{ $t(`roles.${plan.role}`) }}</Badge>
    </CardContent>
    <AlertDialog v-model:open="confirmRemove">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t('plans.removeTitle', { title: plan.title }) }}</AlertDialogTitle>
          <AlertDialogDescription>{{ $t('plans.removeText') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction
            :class="buttonVariants({ variant: 'destructive' })"
            @click="emit('remove')"
          >
            {{ $t('plans.remove') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Card>
</template>
