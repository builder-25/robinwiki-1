/**
 * Local re-export of the sidecar TypeScript types owned by
 * `packages/shared/src/schemas/sidecar.ts`. Downstream components should
 * import sidecar types from `@/lib/sidecarTypes` rather than reaching
 * into `@robin/shared` directly so that if the shared package reorganises
 * its exports, only this file needs to change.
 *
 * Types only — no runtime values are re-exported here.
 */
export type {
  WikiRef,
  WikiInfobox,
  WikiSection,
  WikiCitation,
  WikiMetadata,
} from '@robin/shared/schemas/sidecar'
