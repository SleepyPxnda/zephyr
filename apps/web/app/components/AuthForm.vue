<script setup lang="ts">
import { loginSchema, registerSchema } from '@zephyr/core'

const props = defineProps<{ mode: 'login' | 'register' }>()
const { t } = useI18n()
const { fetch: refreshSession } = useUserSession()
const route = useRoute()

const form = reactive({ email: '', name: '', password: '' })
const fieldErrors = ref<Record<string, string>>({})
const formError = ref('')
const busy = ref(false)

const FIELD_MESSAGES: Record<string, string> = {
  email: 'errors.email',
  name: 'errors.name',
  password: props.mode === 'register' ? 'errors.passwordLength' : 'errors.passwordRequired',
}

async function submit() {
  formError.value = ''
  const parsed =
    props.mode === 'register'
      ? registerSchema.safeParse(form)
      : loginSchema.safeParse({ email: form.email, password: form.password })
  if (!parsed.success) {
    fieldErrors.value = Object.fromEntries(
      parsed.error.issues.map((i) => {
        const field = String(i.path[0] ?? '')
        return [field, t(FIELD_MESSAGES[field] ?? 'errors.unknown')]
      }),
    )
    return
  }
  fieldErrors.value = {}
  busy.value = true
  try {
    await $fetch(`/api/auth/${props.mode}`, { method: 'POST', body: parsed.data })
    await refreshSession()
    const target =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/'
    await navigateTo(target)
  } catch (error) {
    const code = problemCode(error)
    formError.value = t(
      code === 'invalid_credentials' || code === 'email_taken'
        ? `errors.${code}`
        : 'errors.unknown',
    )
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center px-4 py-10">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <p class="font-brand text-2xl font-bold">{{ t('app.name') }}</p>
        <h1 class="leading-none font-semibold">{{ t(`auth.${mode}.title`) }}</h1>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
          <div class="flex flex-col gap-1.5">
            <Label for="email">{{ t('auth.email') }}</Label>
            <Input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              :aria-invalid="!!fieldErrors.email"
              :aria-describedby="fieldErrors.email ? 'email-error' : undefined"
            />
            <p v-if="fieldErrors.email" id="email-error" class="text-sm text-muted-foreground">
              {{ fieldErrors.email }}
            </p>
          </div>
          <div v-if="mode === 'register'" class="flex flex-col gap-1.5">
            <Label for="name">{{ t('auth.name') }}</Label>
            <Input
              id="name"
              v-model="form.name"
              autocomplete="name"
              :aria-invalid="!!fieldErrors.name"
              :aria-describedby="fieldErrors.name ? 'name-error' : undefined"
            />
            <p v-if="fieldErrors.name" id="name-error" class="text-sm text-muted-foreground">
              {{ fieldErrors.name }}
            </p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="password">{{ t('auth.password') }}</Label>
            <Input
              id="password"
              v-model="form.password"
              type="password"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              :aria-invalid="!!fieldErrors.password"
              :aria-describedby="
                fieldErrors.password
                  ? 'password-error'
                  : mode === 'register'
                    ? 'password-hint'
                    : undefined
              "
            />
            <p
              v-if="fieldErrors.password"
              id="password-error"
              class="text-sm text-muted-foreground"
            >
              {{ fieldErrors.password }}
            </p>
            <p
              v-else-if="mode === 'register'"
              id="password-hint"
              class="text-sm text-muted-foreground"
            >
              {{ t('auth.register.passwordHint') }}
            </p>
          </div>
          <p
            v-if="formError"
            role="alert"
            class="rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground"
          >
            {{ formError }}
          </p>
          <Button type="submit" :disabled="busy">{{
            busy ? t('auth.busy') : t(`auth.${mode}.submit`)
          }}</Button>
        </form>
      </CardContent>
      <CardFooter class="text-sm text-muted-foreground">
        {{ t(`auth.${mode}.switch`) }}&nbsp;
        <NuxtLink
          :to="mode === 'login' ? '/register' : '/login'"
          class="font-medium text-foreground underline underline-offset-4"
        >
          {{ t(`auth.${mode}.switchLink`) }}
        </NuxtLink>
      </CardFooter>
    </Card>
  </main>
</template>
