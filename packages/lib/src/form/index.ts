import { Fragment } from "../element.js"
import { generateRandomID } from "../generateId.js"
import { shallowCompare } from "../utils.js"
import { useEffect } from "../hooks/useEffect.js"
import { useMemo } from "../hooks/useMemo.js"
import { useHook, useRequestUpdate } from "../hooks/utils.js"
import { objGet, objSet } from "./utils.js"
import type {
  AsyncValidatorContext,
  FormContext,
  FormController,
  FormFieldContext,
  FormFieldProps,
  FormFieldState,
  FormFieldValidators,
  FormStateSubscriber,
  FormSubscribeProps,
  InferRecordKeyValue,
  RecordKey,
  SelectorState,
  UseFormConfig,
  UseFormInternalState,
  UseFormReturn,
} from "./types"

export type * from "./types"

function createFormController<T extends Record<string, unknown>>(
  config: UseFormConfig<T>
): FormController<T> {
  let isSubmitting = false
  const subscribers = new Set<FormStateSubscriber<T>>()
  const state: T = structuredClone(config.initialValues ?? {}) as T
  const formFieldValidators = {} as {
    [key in RecordKey<T>]: FormFieldValidators<
      RecordKey<T>,
      InferRecordKeyValue<T, key>
    >
  }
  const formFieldDependencies = {} as {
    [key in RecordKey<T>]: Set<RecordKey<T>>
  }
  const formFieldsTouched = {} as {
    [key in RecordKey<T>]?: boolean
  }
  const formFieldUpdaters = new Map<RecordKey<T>, Set<() => void>>()
  const asyncFormFieldValidators = {} as {
    [key in RecordKey<T>]: {
      onChangeAsync?: {
        timeout: number
        epoch: number
        abortController: AbortController | null
      }
    }
  }
  const formFieldErrors = {} as {
    [key in RecordKey<T>]: {
      onMount?: any
      onChange?: any
      onBlur?: any
      onSubmit?: any
      onChangeAsync?: any
    }
  }

  const canSubmit = () => {
    return isAnyFieldValidating() === false && getErrors().length === 0
  }

  const getSelectorState = (): SelectorState<T> => {
    return {
      values: state,
      canSubmit: canSubmit(),
      isSubmitting,
    }
  }

  const updateSubscribers = () => {
    const selectorState = getSelectorState()
    for (const sub of subscribers) {
      const { selector, selection, update } = sub
      const newSelection = selector(selectorState)
      if (shallowCompare(selection, newSelection)) continue
      sub.selection = newSelection
      update()
    }
  }

  const updateFieldComponents = (name: RecordKey<T>) => {
    if (!formFieldUpdaters.has(name)) return
    for (const update of formFieldUpdaters.get(name)!) update()
  }

  const validateField = async <K extends RecordKey<T>>(
    name: K,
    evt: keyof Omit<
      FormFieldValidators<RecordKey<T>, InferRecordKeyValue<T, K>>,
      "onChangeAsyncDebounceMs"
    >
  ) => {
    const fieldErrors = (formFieldErrors[name] ??= {})
    const asyncFieldValidatorStates = (asyncFormFieldValidators[name] ??= {})
    const fieldValidators = formFieldValidators[name] ?? {}

    const validatorCtx = { value: getFieldValue(name) }

    switch (evt) {
      case "onMount": {
        if (!fieldValidators.onMount) return

        fieldErrors.onMount = fieldValidators.onMount(validatorCtx)
        updateSubscribers()
        updateFieldComponents(name)
        break
      }
      case "onChange": {
        if (fieldErrors.onMount) delete fieldErrors.onMount
        formFieldsTouched[name] = true
        if (!fieldValidators.onChange) return

        fieldErrors.onChange = fieldValidators.onChange(validatorCtx)

        if (
          asyncFieldValidatorStates.onChangeAsync &&
          asyncFieldValidatorStates.onChangeAsync.timeout !== -1
        ) {
          window.clearTimeout(asyncFieldValidatorStates.onChangeAsync.timeout)
          asyncFieldValidatorStates.onChangeAsync.abortController?.abort()

          asyncFieldValidatorStates.onChangeAsync = {
            epoch: asyncFieldValidatorStates.onChangeAsync.epoch,
            timeout: -1,
            abortController: null,
          }
          delete fieldErrors.onChangeAsync
        } else if (fieldErrors.onChangeAsync) {
          delete fieldErrors.onChangeAsync
        }

        updateSubscribers()
        updateFieldComponents(name)
        break
      }
      case "onBlur": {
        formFieldsTouched[name] = true
        if (!fieldValidators.onBlur) return
        fieldErrors.onBlur = fieldValidators.onBlur(validatorCtx)
        updateSubscribers()
        updateFieldComponents(name)
        break
      }
      case "onChangeAsync": {
        if (fieldErrors.onChange || !fieldValidators.onChangeAsync) return

        window.clearTimeout(asyncFieldValidatorStates.onChangeAsync?.timeout)

        const epoch = (asyncFieldValidatorStates.onChangeAsync?.epoch ?? 0) + 1
        const debounceMs = fieldValidators.onChangeAsyncDebounceMs ?? 0

        const abortController = new AbortController()
        const asyncValidatorCtx: AsyncValidatorContext<any> = {
          ...validatorCtx,
          abortSignal: abortController.signal,
        }

        if (debounceMs <= 0) {
          fieldErrors.onChangeAsync = await fieldValidators.onChangeAsync(
            asyncValidatorCtx
          )
          updateSubscribers()
          updateFieldComponents(name)
          return
        }
        asyncFieldValidatorStates.onChangeAsync = {
          abortController,
          timeout: window.setTimeout(() => {
            fieldValidators
              .onChangeAsync?.(asyncValidatorCtx)
              .then((result) => {
                if (fieldErrors.onChange) return
                if (epoch !== asyncFieldValidatorStates.onChangeAsync?.epoch) {
                  return
                }
                fieldErrors.onChangeAsync = result
                asyncFieldValidatorStates.onChangeAsync = {
                  timeout: -1,
                  epoch,
                  abortController,
                }
                updateSubscribers()
                updateFieldComponents(name)
              })
          }, debounceMs),
          epoch,
        }
        updateSubscribers()
        break
      }
      case "onSubmit": {
        fieldErrors.onSubmit = fieldValidators.onSubmit?.(validatorCtx)
      }
    }
  }

  const getFieldValue = <K extends RecordKey<T>>(
    name: K
  ): InferRecordKeyValue<T, K> => {
    return objGet(state, (name as string).split(".")) as InferRecordKeyValue<
      T,
      K
    >
  }

  const getFieldState = <K extends RecordKey<T>>(
    name: K
  ): FormFieldState<T, K> => {
    let errors: any[] = []
    let isValidating = false
    const fieldErrors = formFieldErrors[name] ?? {}
    const asyncMeta = asyncFormFieldValidators[name] ?? {}
    if (asyncMeta.onChangeAsync && asyncMeta.onChangeAsync.timeout !== -1) {
      isValidating = true
    }

    if (!isValidating) {
      errors.push(
        ...[
          fieldErrors.onChangeAsync,
          fieldErrors.onMount,
          fieldErrors.onChange,
          fieldErrors.onBlur,
        ].filter(Boolean)
      )
    }

    return {
      value: getFieldValue(name),
      errors,
      isTouched: !!formFieldsTouched[name],
      isValidating,
    }
  }

  const onFieldChanged = (name: RecordKey<T>) => {
    validateField(name, "onChange")
    if (formFieldValidators[name]?.onChangeAsync) {
      validateField(name, "onChangeAsync")
    }

    if (formFieldDependencies[name]) {
      for (const dependentOn of formFieldDependencies[name]) {
        validateField(dependentOn, "onChange")
        if (formFieldValidators[dependentOn]?.onChangeAsync) {
          validateField(dependentOn, "onChangeAsync")
        }
      }
    }

    formFieldUpdaters.get(name)?.forEach((update) => update())
  }

  const setFieldValue = <K extends RecordKey<T>>(
    name: K,
    value: InferRecordKeyValue<T, K>
  ) => {
    objSet(state, (name as string).split("."), value)

    onFieldChanged(name)
  }

  const removeFieldMeta = (name: RecordKey<T>) => {
    delete formFieldErrors[name]
    delete asyncFormFieldValidators[name]
    delete formFieldsTouched[name]
    delete formFieldValidators[name]
    formFieldUpdaters.delete(name)
  }

  const arrayFieldReplace = (name: RecordKey<T>, index: number, value: any) => {
    const path = [...(name as string).split("."), index.toString()]
    objSet(state, path, value)

    removeFieldMeta(`${name}.${index}` as RecordKey<T>)

    onFieldChanged(name)
    updateFieldComponents(name)
  }

  const arrayFieldPush = (name: RecordKey<T>, value: any) => {
    const path = [...(name as string).split(".")]
    const arr = objGet<any[]>(state, path)
    arr.push(value)

    onFieldChanged(name)
    updateFieldComponents(name)
  }

  const arrayFieldRemove = (name: RecordKey<T>, index: number) => {
    const path = [...(name as string).split(".")]
    const arr = objGet<any[]>(state, path)
    arr.splice(index, 1)

    removeFieldMeta(`${name}.${index}` as RecordKey<T>)

    onFieldChanged(name)
    updateFieldComponents(name)
  }

  const getErrors = () => {
    const errors: string[] = []
    for (const fieldName in formFieldErrors) {
      const meta = formFieldErrors[fieldName as RecordKey<T>]
      errors.push(
        ...[
          meta.onChangeAsync,
          meta.onMount,
          meta.onChange,
          meta.onBlur,
        ].filter(Boolean)
      )
    }
    return errors
  }

  const isAnyFieldValidating = () => {
    for (const fieldName in asyncFormFieldValidators) {
      const fieldValidators =
        asyncFormFieldValidators[fieldName as RecordKey<T>]
      if (
        fieldValidators.onChangeAsync &&
        fieldValidators.onChangeAsync.timeout !== -1
      ) {
        return true
      }
    }
    return false
  }

  const connectField = (name: RecordKey<T>, update: () => void) => {
    if (!formFieldUpdaters.has(name)) {
      formFieldUpdaters.set(name, new Set())
    }
    formFieldUpdaters.get(name)!.add(update)
  }
  const disconnectField = (name: RecordKey<T>, update: () => void) => {
    if (!formFieldUpdaters.has(name)) return
    formFieldUpdaters.get(name)!.delete(update)

    const asyncValidators = asyncFormFieldValidators[name] ?? {}
    const { abortController, timeout } = asyncValidators.onChangeAsync ?? {}
    window.clearTimeout(timeout)
    abortController?.abort()
  }

  const reset = (values?: T) => {
    if (values) {
      for (const key in values) {
        state[key] = values[key]
      }
    } else {
      const initialValues = (config.initialValues ?? {}) as T
      const keys = new Set([
        ...Object.keys(state),
        ...Object.keys(initialValues),
      ])
      for (const key of keys) {
        if (key in initialValues) {
          state[key as RecordKey<T>] = structuredClone(
            initialValues[key] as T[RecordKey<T>]
          )
        } else {
          delete state[key]
        }
      }
    }
    for (const fieldName in formFieldsTouched) {
      delete formFieldsTouched[fieldName as RecordKey<T>]
    }
    for (const fieldName in asyncFormFieldValidators) {
      const asyncFieldValidators =
        asyncFormFieldValidators[fieldName as RecordKey<T>]
      const { timeout, abortController } =
        asyncFieldValidators?.onChangeAsync ?? {}
      if (timeout !== -1) {
        window.clearTimeout(timeout)
      }
      abortController?.abort()
      delete asyncFormFieldValidators[fieldName as RecordKey<T>]
    }
    for (const fieldName in formFieldErrors) {
      delete formFieldErrors[fieldName as RecordKey<T>]
    }
    updateSubscribers()
    formFieldUpdaters.forEach((updaters) => {
      updaters.forEach((update) => update())
    })
  }

  const validateForm = async () => {
    for (const fieldName in formFieldValidators) {
      const fieldValidators = formFieldValidators[fieldName as RecordKey<T>]
      if (fieldValidators?.onChange) {
        await validateField(fieldName as RecordKey<T>, "onChange")
      }
      if (fieldValidators?.onSubmit) {
        await validateField(fieldName as RecordKey<T>, "onSubmit")
      }
      if (
        !formFieldErrors[fieldName as RecordKey<T>]?.onChange &&
        fieldValidators?.onChangeAsync
      ) {
        const value = state[fieldName] as T[RecordKey<T>]
        const abortController = new AbortController()
        const asyncValidators = (asyncFormFieldValidators[
          fieldName as RecordKey<T>
        ] ??= {})
        const epoch = asyncValidators.onChangeAsync?.epoch ?? 0
        asyncValidators.onChangeAsync = {
          timeout: 0,
          epoch,
          abortController,
        }
        const ctx: AsyncValidatorContext<any> = {
          value,
          abortSignal: abortController.signal,
        }
        formFieldErrors[fieldName as RecordKey<T>].onChangeAsync =
          await fieldValidators.onChangeAsync(ctx)
        asyncValidators.onChangeAsync = {
          timeout: -1,
          epoch,
          abortController: null,
        }
        updateFieldComponents(fieldName as RecordKey<T>)
        updateSubscribers()
      }
    }
    return getErrors()
  }

  const deleteField = (name: RecordKey<T>) => {
    delete state[name]
    delete formFieldErrors[name]
    delete asyncFormFieldValidators[name]
    delete formFieldsTouched[name]
    delete formFieldValidators[name]
    formFieldUpdaters.delete(name)

    updateSubscribers()
  }
  const resetField = (name: RecordKey<T>) => {
    if (config.initialValues?.[name]) {
      state[name] = config.initialValues[name]
    } else {
      delete state[name]
    }
    delete formFieldErrors[name]
    delete asyncFormFieldValidators[name]
    delete formFieldsTouched[name]

    updateSubscribers()
  }

  const getFormContext = (): FormContext<T> => {
    return {
      deleteField,
      resetField,
      setFieldValue,
      validateForm,
      state,
    }
  }

  const setFieldValidators = <K extends RecordKey<T>>(
    name: K,
    validators: FormFieldValidators<RecordKey<T>, InferRecordKeyValue<T, K>>
  ) => {
    formFieldValidators[name] = validators
    if (validators.dependentOn && validators.dependentOn.length > 0) {
      for (const dependentOn of validators.dependentOn) {
        if (!formFieldDependencies[dependentOn]) {
          formFieldDependencies[dependentOn] = new Set()
        }
        formFieldDependencies[dependentOn].add(name)
      }
    }
  }

  return {
    subscribers,
    state,
    validateField,
    getFieldState,
    setFieldValue,
    arrayFieldReplace,
    arrayFieldPush,
    arrayFieldRemove,
    connectField,
    disconnectField,
    setFieldValidators,
    getSelectorState,
    validateForm,
    reset,
    getFormContext,
  }
}

export function useForm<T extends Record<string, unknown> = {}>(
  config: UseFormConfig<T>
): UseFormReturn<T> {
  return useHook(
    "useForm",
    {} as UseFormInternalState<T>,
    ({ hook, isInit }) => {
      if (isInit) {
        const $controller = (hook.formController = createFormController(config))

        hook.Field = function Field<
          Name extends RecordKey<T>,
          Validators extends FormFieldValidators<
            RecordKey<T>,
            InferRecordKeyValue<T, Name>
          >,
          IsArray extends boolean
        >(props: FormFieldProps<T, Name, Validators, IsArray>) {
          const update = useRequestUpdate()
          if (props.validators) {
            $controller.setFieldValidators(props.name, props.validators)
          }
          useEffect(() => {
            $controller.connectField(props.name, update)
            if (props.validators?.onMount) {
              $controller.validateField(props.name, "onMount")
            }
            return () => {
              $controller.disconnectField(props.name, update)
            }
          }, [])

          const fieldState = $controller.getFieldState(props.name)

          const childProps: FormFieldContext<T, Name, Validators, false> = {
            name: props.name,
            state: fieldState as FormFieldContext<
              T,
              Name,
              Validators,
              false
            >["state"],
            handleChange: (value: InferRecordKeyValue<T, Name>) => {
              $controller.setFieldValue(props.name, value)
            },
            handleBlur: () => {
              $controller.validateField(props.name, "onBlur")
            },
          }

          if (props.array) {
            const asArrayProps = childProps as FormFieldContext<
              T,
              Name,
              Validators,
              true
            >
            asArrayProps.items = {
              replace: (index: number, value: any) => {
                $controller.arrayFieldReplace(props.name, index, value)
              },
              push: (value: any) => {
                $controller.arrayFieldPush(props.name, value)
              },
              remove: (index: number) => {
                $controller.arrayFieldRemove(props.name, index)
              },
            }
          }
          return Fragment({
            key: useMemo(generateRandomID, []),
            children: props.children(
              childProps as FormFieldContext<T, Name, Validators, IsArray>
            ),
          })
        }
        hook.Subscribe = function Subscribe<
          Selector extends (state: SelectorState<T>) => unknown
        >(props: FormSubscribeProps<T, Selector, ReturnType<Selector>>) {
          const selection = useHook(
            "useFormSubscription",
            { sub: null! as FormStateSubscriber<T> },
            ({ hook, isInit, update }) => {
              if (isInit) {
                hook.sub = {
                  selector: props.selector,
                  selection: props.selector($controller.getSelectorState()),
                  update,
                }
                $controller.subscribers.add(hook.sub)
                hook.cleanup = () => $controller.subscribers.delete(hook.sub)
              }
              return hook.sub.selection
            }
          ) as ReturnType<Selector>
          return props.children(selection)
        }
      }
      return {
        Field: hook.Field,
        Subscribe: hook.Subscribe,
        handleSubmit: async () => {
          const errors = await hook.formController.validateForm()
          const formCtx = hook.formController.getFormContext()
          if (errors.length) return config.onSubmitInvalid?.(formCtx)
          await config.onSubmit?.(formCtx)
        },
        reset: (values?: T) => hook.formController.reset(values),
        getFieldState: <K extends RecordKey<T>>(name: K) =>
          hook.formController.getFieldState(name),
      } satisfies UseFormReturn<T>
    }
  )
}
