import { customAlphabet } from 'nanoid'

/** URL-safe nanoid without - and _ characters */
export const nanoid = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  21
)
