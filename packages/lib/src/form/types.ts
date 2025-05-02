type ObjectValuesArray<T extends object> = T[keyof T][]

type IsObject<T> = T extends object ? (T extends any[] ? false : true) : false

type InferKeyWithIndices<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends Array<infer U> | undefined
    ? IsObject<U> extends true
      ? // If it's an array of objects, infer the index and recurse into the object properties
        | `${Prefix}${K}`
          | `${Prefix}${K}.${number}`
          | InferKeyWithIndices<U, `${Prefix}${K}.${number}.`>
      : `${Prefix}${K}` | `${Prefix}${K}.${number}` // For arrays of primitives, only support indices
    : IsObject<T[K]> extends true
    ? // If it's an object, recurse into its properties
      `${Prefix}${K}` | InferKeyWithIndices<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}` // If it's a primitive, return the key
}[keyof T & string]

export type RecordKey<T extends Record<string, unknown>> =
  InferKeyWithIndices<T>

type InferValue<
  T,
  Path extends string
> = Path extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? InferValue<T[K], Rest> // Recursively resolve objects
    : K extends `${number}` // Check if it's a numeric index for an array
    ? T extends Array<infer U> | undefined
      ? InferValue<U, Rest> // Recursively resolve array elements
      : never
    : never
  : Path extends keyof T
  ? T[Path] // Direct lookup for simple keys
  : Path extends `${number}` // If the path is numeric (array index)
  ? T extends Array<infer U> | undefined
    ? U // Resolve the array element type
    : never
  : never

export type InferRecordKeyValue<
  T extends Record<string, unknown>,
  K extends RecordKey<T>
> = InferValue<T, K>

export type ValidatorContext<T> = {
  value: T
}

type FormFieldValidator<T extends unknown> = (
  context: ValidatorContext<T>
) => any

export type AsyncValidatorContext<T> = {
  value: T
  abortSignal: AbortSignal
}

type AsyncFormFieldValidator<T extends unknown> = (
  context: AsyncValidatorContext<T>
) => Promise<any>

export type FormFieldValidators<RecordKey extends string, Value> = {
  dependentOn?: RecordKey[]
  onBlur?: FormFieldValidator<Value>
  onChange?: FormFieldValidator<Value>
  onChangeAsyncDebounceMs?: number
  onChangeAsync?: AsyncFormFieldValidator<Value>
  onMount?: FormFieldValidator<Value>
  onSubmit?: FormFieldValidator<Value>
}

type Falsy = false | null | undefined

type InferValidatorReturn<T> = T extends Falsy
  ? never
  : T extends Promise<infer U>
  ? InferValidatorReturn<U>
  : T

type InferFormFieldErrors<
  RecordKey extends string,
  T extends FormFieldValidators<RecordKey, any>
> = ObjectValuesArray<{
  [K in keyof T]: T[K] extends FormFieldValidator<any>
    ? InferValidatorReturn<ReturnType<T[K]>>
    : never
}>

export type FormFieldContext<
  T extends Record<string, unknown>,
  Name extends RecordKey<T>,
  Validators extends FormFieldValidators<
    RecordKey<T>,
    InferRecordKeyValue<T, Name>
  >,
  IsArray extends Boolean
> = {
  name: Name
  state: {
    value: InferRecordKeyValue<T, Name>
    errors: InferFormFieldErrors<RecordKey<T>, Validators>
    isTouched: boolean
    isValidating: boolean
  }
  handleChange: (value: InferRecordKeyValue<T, Name>) => void
  handleBlur: () => void
} & (IsArray extends true
  ? {
      items: {
        replace: (
          index: number,
          value: InferRecordKeyValue<T, Name> extends Array<infer U> ? U : any
        ) => void
        push: (
          value: InferRecordKeyValue<T, Name> extends Array<infer U> ? U : any
        ) => void
        remove: (index: number) => void
      }
    }
  : {})

export type AnyFormFieldContext<
  T extends Record<string, any> = Record<string, any>
> = FormFieldContext<T, any, any, any>

export type FormFieldState<
  T extends Record<string, any>,
  K extends RecordKey<T>
> = {
  value: InferRecordKeyValue<T, K>
  errors: InferFormFieldErrors<
    K,
    FormFieldValidators<K, InferRecordKeyValue<T, K>>
  >
  isTouched: boolean
  isValidating: boolean
}

export type FormFieldProps<
  T extends Record<string, unknown>,
  Name extends RecordKey<T>,
  Validators extends FormFieldValidators<
    RecordKey<T>,
    InferRecordKeyValue<T, Name>
  >,
  IsArray extends boolean
> = {
  name: Name
  validators?: Validators

  array?: IsArray
  children: (
    context: FormFieldContext<T, Name, Validators, IsArray>
  ) => JSX.Element
}

export type FormFieldComponent<T extends Record<string, unknown>> = <
  Name extends RecordKey<T>,
  Validators extends FormFieldValidators<
    RecordKey<T>,
    InferRecordKeyValue<T, Name>
  >,
  IsArray extends boolean
>(
  props: FormFieldProps<T, Name, Validators, IsArray>
) => JSX.Element

export type SelectorState<T extends Record<string, unknown>> = {
  values: T
  canSubmit: boolean
  isSubmitting: boolean
}

export type FormSubscribeProps<
  T extends Record<string, unknown>,
  SelectorFunction extends (state: SelectorState<T>) => unknown,
  U
> = {
  selector: SelectorFunction
  children: (selection: U) => JSX.Element
}

type FormSubscribeComponent<T extends Record<string, unknown>> = <
  Selector extends (state: SelectorState<T>) => unknown
>(
  props: FormSubscribeProps<T, Selector, ReturnType<Selector>>
) => JSX.Element

export type UseFormReturn<T extends Record<string, unknown>> = {
  Field: FormFieldComponent<T>
  Subscribe: FormSubscribeComponent<T>
  getFieldState: <K extends RecordKey<T>>(name: K) => FormFieldState<T, K>
  handleSubmit: () => Promise<void>
  reset: () => void
}

export type FormContext<T extends Record<string, unknown>> = {
  state: T
  validateForm: () => Promise<any[]>
  resetField: (name: RecordKey<T>) => void
  deleteField: (name: RecordKey<T>) => void
  setFieldValue: <K extends RecordKey<T>>(
    name: K,
    value: InferRecordKeyValue<T, K>
  ) => void
}

export type UseFormConfig<T extends Record<string, unknown>> = {
  initialValues?: T
  onSubmit?: (ctx: FormContext<T>) => void | Promise<void>
  onSubmitInvalid?: (ctx: FormContext<T>) => void | Promise<void>
}

export interface FormStateSubscriber<T extends Record<string, unknown>> {
  selector: (state: SelectorState<T>) => unknown
  selection: ReturnType<this["selector"]>
  update: () => void
}

export type UseFormInternalState<T extends Record<string, unknown>> = {
  Field: FormFieldComponent<T>
  Subscribe: FormSubscribeComponent<T>
  formController: FormController<T>
}

export type FormController<T extends Record<string, unknown>> = {
  subscribers: Set<FormStateSubscriber<T>>
  state: T
  validateField: (
    name: RecordKey<T>,
    type: "onChange" | "onSubmit" | "onMount" | "onBlur"
  ) => Promise<void>
  getFieldState: <K extends RecordKey<T>>(name: K) => FormFieldState<T, K>
  setFieldValue: (
    name: RecordKey<T>,
    value: InferRecordKeyValue<T, RecordKey<T>>
  ) => void
  arrayFieldReplace: <K extends RecordKey<T>>(
    name: K,
    index: number,
    value: InferRecordKeyValue<T, K> extends Array<infer U> ? U : any
  ) => void
  arrayFieldPush: <K extends RecordKey<T>>(
    name: K,
    value: InferRecordKeyValue<T, K> extends Array<infer U> ? U : any
  ) => void
  arrayFieldRemove: (name: RecordKey<T>, index: number) => void
  connectField: (name: RecordKey<T>, update: () => void) => void
  disconnectField: (name: RecordKey<T>, update: () => void) => void
  setFieldValidators: <K extends RecordKey<T>>(
    name: K,
    validators: FormFieldValidators<RecordKey<T>, InferRecordKeyValue<T, K>>
  ) => void
  getSelectorState: () => any
  validateForm: () => Promise<string[]>
  getFormContext: () => FormContext<T>
  reset: (values?: T) => void
}
