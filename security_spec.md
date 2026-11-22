# Security Specification — Nasrullah Studio Cloud Project Library

## 1. Data Invariants
1. Every document in `/projects/{projectId}` MUST belong to a single verified authenticated owner (`ownerId == request.auth.uid` and `request.auth.token.email_verified == true`).
2. `id` inside the document MUST match the path parameter `{projectId}` and conform to `^[a-zA-Z0-9_\-]+$` with length `<= 128`.
3. `ownerId`, `id`, and `createdAt` are immutable after creation; `createdAt` and `updatedAt` MUST equal `request.time`.
4. All strings and arrays have explicit upper bounds (`scriptText <= 12000`, `title <= 180`, `dialogueLines.size() <= 24`) to prevent Denial of Wallet attacks.
5. `allow list` MUST strictly enforce `resource.data.ownerId == request.auth.uid` on the server side (never delegating filtering to client code).
6. No shadow fields or PII fields are allowed (`data.keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update).

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Create**: Creating `/projects/proj_1` without `request.auth`.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` creating `/projects/proj_1`.
3. **Identity Spoofing on Create**: User A setting `ownerId: "user_B"` when creating `/projects/proj_2`.
4. **Shadow Field Injection on Create**: Valid payload + extra field `isAdmin: true`.
5. **ID Poisoning**: Document path `/projects/bad$id;drop` or 200-char ID string.
6. **Path/Body ID Mismatch**: Path `/projects/proj_1` with body `id: "proj_2"`.
7. **Forged Timestamp**: Client sending backdated `createdAt` instead of `serverTimestamp()` (`request.time`).
8. **Cross-User Read (Get)**: User B reading `/projects/proj_owned_by_A`.
9. **Blanket List Scraping**: User B querying `/projects` without `where('ownerId', '==', userB.uid)`.
10. **Owner Hijack on Update**: User A updating `ownerId` to `"user_B"`.
11. **Value Poisoning on Update**: User A updating `scriptText` to a 20,000-character string or a number.
12. **Unbounded Array Attack**: Creating/updating `dialogueLines` with 25+ entries or non-map first element.
