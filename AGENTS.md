# Architecture Rules

- Keep LINE-photo URL preparation and native share-file conversion in `src/lib/trip-photos.ts` so employee and admin reports use identical resilient image handling.