import { customAlphabet } from 'nanoid'

/** URL-safe nanoid without - and _ characters */
export const nanoid = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  21
)

/** 24-char nanoid for published wiki slugs */
export const nanoid24 = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  24
)
