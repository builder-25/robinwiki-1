import type { CSSProperties } from "react";

const SERIF =
  "var(--font-stix-two-text), 'STIX Two Text', Georgia, serif" as const;
const SANS =
  "var(--font-noto-sans), 'Noto Sans', sans-serif" as const;
const MONO =
  "var(--font-ibm-plex-mono), 'IBM Plex Mono', monospace" as const;

export const FONT = { SERIF, SANS, MONO } as const;

/**
 * Shared type scale — three families: STIX Two Text (serif headings),
 * Noto Sans (body/UI), IBM Plex Mono (code/indices).
 * Sizes derived from designsys.html spec.
 */
export const T = {
  hero: {
    fontFamily: SERIF,
    fontSize: 48,
    fontWeight: 400,
    lineHeight: "50px",
  } satisfies CSSProperties,

  h1: {
    fontFamily: SERIF,
    fontSize: 32,
    fontWeight: 400,
    lineHeight: "38px",
  } satisfies CSSProperties,

  h2: {
    fontFamily: SERIF,
    fontSize: 24,
    fontWeight: 600,
    lineHeight: "30px",
  } satisfies CSSProperties,

  h3: {
    fontFamily: SERIF,
    fontSize: 18,
    fontWeight: 600,
    lineHeight: "24px",
  } satisfies CSSProperties,

  h4: {
    fontFamily: SERIF,
    fontSize: 16,
    fontWeight: 600,
    lineHeight: "20px",
  } satisfies CSSProperties,

  sectionTitle: {
    fontFamily: SANS,
    fontSize: 20,
    fontWeight: 600,
    lineHeight: "1.3",
  } satisfies CSSProperties,

  body: {
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: "22px",
  } satisfies CSSProperties,

  bodySmall: {
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: "22px",
  } satisfies CSSProperties,

  caption: {
    fontFamily: SANS,
    fontSize: 13,
    fontWeight: 400,
    lineHeight: "18px",
  } satisfies CSSProperties,

  micro: {
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: "17px",
  } satisfies CSSProperties,

  tiny: {
    fontFamily: SANS,
    fontSize: 10,
    fontWeight: 400,
    lineHeight: "14px",
  } satisfies CSSProperties,

  overline: {
    fontFamily: SANS,
    fontSize: 13,
    fontWeight: 400,
    lineHeight: "35px",
    textTransform: "uppercase",
  } satisfies CSSProperties,

  button: {
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: "20px",
  } satisfies CSSProperties,

  buttonSmall: {
    fontFamily: SANS,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: "20px",
  } satisfies CSSProperties,

  cardTitle: {
    fontFamily: SANS,
    fontSize: 15,
    fontWeight: 500,
    lineHeight: "15px",
  } satisfies CSSProperties,

  cardDesc: {
    fontFamily: SANS,
    fontSize: 10,
    fontWeight: 500,
    lineHeight: "15px",
  } satisfies CSSProperties,

  helper: {
    fontFamily: SANS,
    fontSize: 11,
    fontWeight: 400,
    lineHeight: "16px",
  } satisfies CSSProperties,

  label: {
    fontFamily: SANS,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: "16px",
    letterSpacing: "0.32px",
  } satisfies CSSProperties,

  input: {
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: "18px",
    letterSpacing: "0.16px",
  } satisfies CSSProperties,

  mono: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: 400,
    lineHeight: "1.5",
  } satisfies CSSProperties,

  monoSmall: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: 400,
    lineHeight: "1.45",
  } satisfies CSSProperties,
} as const;
