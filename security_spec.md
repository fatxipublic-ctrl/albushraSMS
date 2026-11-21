# Security Specification — ABSMS Cloud Firestore Rules

## 1. Data Invariants

1. **Verified Identity Gate**: Every read and write operation requires `request.auth != null` with `request.auth.token.email_verified == true`. Unverified emails and unauthenticated clients receive `PERMISSION_DENIED`.
2. **Staff Workspace & Bootstrapped Admin Ownership**: Document creation enforces `incoming().ownerUid == request.auth.uid`, `request.auth.uid in incoming().authorizedUids`, and `authorizedUids.size() >= 1 && authorizedUids.size() <= 10`. List queries enforce `isBootstrappedAdminEmail() || request.auth.uid == resource.data.ownerUid || request.auth.uid in resource.data.authorizedUids` without expensive `get()` or `exists()` calls.
3. **Referential Student Integrity**: A `student_contacts`, `attendance_current`, `exams`, or `fees` document cannot be created unless its referenced `/students/$(studentId)` document exists post-batch (`existsAfter(...)`).
4. **PII Isolation**: Student phone numbers are isolated into `/student_contacts/{studentId}`, strictly readable only by `isOwnerOrBootstrappedAdmin()`, never via blanket signed-in reads.
5. **Temporal & Immutability Integrity**: `createdAt` must equal `request.time` on creation and never change on update; `updatedAt` must equal `request.time`; `ownerUid` and primary `id`/`studentId` fields are immutable.
6. **Strict Schema & Bounds**: Every collection enforces exact `hasAll` + `hasOnly` field sets, string length limits, bounded arrays, enum sets, and `^[a-zA-Z0-9_\-]+$` ID regexes.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **P01 — Unauthenticated Student Read/Write**: `auth = null` attempting `get /students/ABC-0001-2026`. Expected: `PERMISSION_DENIED`.
2. **P02 — Unverified Email Spoof**: `auth = { uid: 'u2', token: { email: 'fatxipublic@gmail.com', email_verified: false } }` reading `/students/ABC-0001-2026`. Expected: `PERMISSION_DENIED`.
3. **P03 — Owner Spoofing on Student Creation**: User `u1` creates student with `{ ownerUid: 'victim-uid', authorizedUids: ['victim-uid'] }`. Expected: `PERMISSION_DENIED`.
4. **P04 — Shadow Field Injection on Student**: User `u1` creates student containing `{ ..., extraShadowPrivilege: true }`. Expected: `PERMISSION_DENIED`.
5. **P05 — Resource Poisoning Long ID**: User `u1` writes to `/students/${'A'.repeat(200)}`. Expected: `PERMISSION_DENIED`.
6. **P06 — Orphaned Exam Result**: User `u1` creates `/exams/EX-999` referencing `studentId: 'ABC-9999-2026'` where no student document exists. Expected: `PERMISSION_DENIED`.
7. **P07 — Orphaned Fee Ledger**: User `u1` creates `/fees/FEE-999` referencing missing `studentId`. Expected: `PERMISSION_DENIED`.
8. **P08 — Out-of-Range Exam Score**: User `u1` creates exam with `score: 150` or `score: -10`. Expected: `PERMISSION_DENIED`.
9. **P09 — Client-Forged Timestamp**: User `u1` creates student with `createdAt: '2020-01-01'` instead of `request.time`. Expected: `PERMISSION_DENIED`.
10. **P10 — Tampering with Immutable Attendance History**: Non-admin user attempts `update` on `/attendance_history/AH-1`. Expected: `PERMISSION_DENIED`.
11. **P11 — Unauthorized PII Contact Scrape**: Non-owner verified user `stranger@example.com` calls `get` or `list` on `/student_contacts/ABC-0001-2026`. Expected: `PERMISSION_DENIED`.
12. **P12 — Self-Promotion to Admin**: User `u1` attempts to create `/admins/u1` with `{ role: 'Admin' }`. Expected: `PERMISSION_DENIED`.
