import type { CSSProperties } from "react";

const SERIF =
  "var(--font-source-serif-4), 'Source Serif 4', Georgia, serif" as const;
const SANS = "var(--font-inter), 'Inter', sans-serif" as const;

export const FONT = { SERIF, SANS } as const;

/**
 * Shared type scale — two families only (Source Serif 4 for headings, Inter for everything else).
 * Sizes derived from Wikimedia/Wikipedia Codex design system, adapted for this app.
 */
export const T = {
  hero: {
    fontFamily: SERIF,
    fontSize: 40,
    fontWeight: 400,
    lineHeight: "48px",
  } satisfies CSSProperties,

  h1: {
    fontFamily: SERIF,
    fontSize: 28,
    fontWeight: 400,
    lineHeight: "35px",
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

  body: {
    fontFamily: SANS,
    fontSize: 16,
    fontWeight: 400,
    lineHeight: "26px",
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
    fontSize: 12,
    fontWeight: 600,
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
    fontSize: 12,
    fontWeight: 400,
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
} as const;
