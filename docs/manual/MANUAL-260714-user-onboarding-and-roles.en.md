---
document_id: MANUAL-USERS-260714-EN
version: 1.0.0
status: active
created: 2026-07-14
authors:
  - gray.kim@amoeba.group
audience: Academy operators / administrators (ADMIN·STAFF) — responsible for user accounts and role operations
source_of_truth:
  - backend/src/modules/acm-csl/application/csl-enrollment-registration.service.ts (CLASS_STARTED auto-registration)
  - backend/src/modules/acm-auth/application/portal-account.service.ts (portal account issuance/login)
  - backend/src/modules/acm-std/application/student.service.ts (student email required/duplicate)
  - backend/src/modules/acm-std/application/parent.service.ts (parent linkage)
  - backend/src/modules/acm-tch/application/teacher.service.ts (teacher registration)
  - backend/src/modules/acm-cls/** (classes/sessions/attendance)
related:
  - docs/manual/MANUAL-260624-csl-consultation-userguide.md (consultation 6-stage detail)
  - docs/plan/PLN-260706-acm-portal-accounts-and-role-portals.md
  - docs/plan/PLN-260708-portal-tenant-scoped-login.md
  - docs/plan/PLN-260714-csl-std-enrollment-portal.md
---

# User Onboarding & Roles Manual

> This manual explains the entire journey by which students and parents who arrive through the
> website consultation request go through **consultation → enrollment → attending** and end up with
> **their own respective student, parent, and teacher accounts**.
> For the detailed input fields of the 6 consultation stages, see the [Consultation Management User Manual](MANUAL-260624-csl-consultation-userguide.md);
> this manual focuses on **account creation and roles**. Screen labels follow the actual UI (Korean).

---

## 0. Two account systems — understand this first

TAC has **two kinds of login with different characters**. Let's distinguish them first to avoid confusion.

| Category | Operations console account (Admin/Console) | Portal account (Portal) |
|------|-------------------------------|--------------------|
| Login location | `/admin/*` operations console | `/portal/login` portal |
| Table | `amb_acm_user` | `amb_acm_portal_account` |
| Target | **Administrators · Teachers · Staff** | **Students · Parents · Teachers** |
| Role values | `ADMIN` / `TEACHER` / `STAFF` / `APP_ADMIN` | `STUDENT` / `PARENT` / `TEACHER` |
| Purpose | Academy operations, consultation, class management | Viewing notices, class schedules, resources |

- **A teacher can have both accounts.** Console login (class/attendance management) and portal login (portal viewing) are separate.
- **Students and parents have only a portal account** (they do not log in to the operations console).
- All accounts and data are **isolated per academy (tenant)**. Accounts of other academies are not visible.

---

## 1. End-to-end flow

```
[Web consultation request]   [Operations console — Consultation Management /admin/csl]        [Account issuance]
Homepage form        ─▶   1.Intake → 2.Level Test → 3.Demo Class → 4.Enrollment Counseling → 5.Payment
(student/parent input)                                                │
                                                                      ▼ On entering 6.Enrollment
                                                        ┌──────────────────────────────────────────┐
                                                        │ Student auto-created (Student Mgmt /admin/std)│
                                                        │ Parent auto-created + linked to student       │
                                                        │ Student·parent portal accounts auto-prepared  │
                                                        │ Level test scores inherited by the student    │
                                                        └──────────────────────────────────────────┘
                                                                      │ [수강등록완료] (Complete Enrollment) button
                                                                      ▼
                                                                7.Attending

[Teacher] Administrator registers directly (/admin/tch) ─▶ [Register class schedule /admin/cls: teacher·subject·weekday·time + add students]
                                                         ─▶ [Conduct class: record session attendance·feedback]
```

**Core rules in one line each**
- Student and parent accounts are created **automatically** when a consultation reaches **6. Enrollment** (administrators don't need to create them by hand).
- Teachers are registered **directly by an administrator** (not auto-created).
- Portal login always requires all three: **(academy code + ID + password)**.

---

## 2. User types & roles

### 2.1 Role summary table

| User | Account system | Role/kind | Account creator | Main permissions |
|--------|-----------|-----------|----------------|-----------|
| **Administrator (director/lead)** | Console | `ADMIN` | AMA integration / initial seed | All features. Register/edit/delete teachers, confirm tuition payment, reverse stages, issue portal accounts |
| **Staff (non-homeroom staff)** | Console | `STAFF` | Administrator | Use consultation·class screens, import AMA teachers. **Cannot register/edit the teacher master** |
| **Teacher** | Console (optional) + Portal (optional) | Console `TEACHER` / Portal `TEACHER` | Administrator (at teacher registration) | Conduct assigned classes, record attendance·feedback, write demo class feedback. Cannot manage the teacher master |
| **Student** | Portal | `STUDENT` | **Automatic** (6. Enrollment) or manual in Student Management | View notices, class schedule, and resources in the portal |
| **Parent** | Portal | `PARENT` | **Automatic** (6. Enrollment) or manual in Student Management | View child-related notices and schedules in the portal, request classes |
| (Platform operator) | Console | `APP_ADMIN` | AMA platform | System/tenant management (setting academy codes, etc.) |

> Console roles are derived from the AMA platform grade: MASTER/OWNER/MANAGER → **ADMIN**, jobRole=TEACHER → **TEACHER**, otherwise → **STAFF**.

### 2.2 Role details for each user

- **Student (STUDENT)** — The enrolled student themselves. In the portal they view notices, class schedule (calendar), and resources **relevant to them**. Their login ID is **their own email**.
- **Parent (PARENT)** — The student's guardian. A student can have multiple guardians and a guardian can have multiple children, and one **primary guardian** is designated. In the portal they can view child-related information and request classes.
- **Teacher (TEACHER)** — Registered directly by an administrator. Records the schedule, attendance, and feedback (progress) of assigned classes, and writes demo class feedback in the consultation pipeline. **Only administrators manage the teacher roster (master).**

---

## 3. Public intake — the starting point of an account

Students and parents start from the **public homepage forms**. There are two kinds, and once received they accumulate in the operations console's
**Consultation Management (`/admin/csl`) as new consultations in the 1. Intake state**.

| Form | Screen | Main inputs | Intake result |
|----|------|-----------|-----------|
| **Consultation request** | `/web/contact` | Student name·grade / **guardian name·phone (required)** / consultation purpose (multiple) | Source=homepage, request type=consultation only |
| **Level test (MAP) request** | `/web/test` | Student Korean·English name·date of birth·gender / guardian name·phone·email / test country·city | Source=homepage, request type=test only |

> At this stage, **no student/parent account is created yet.** The intake exists only as a "consultation case";
> the actual student/parent records and portal accounts are created at the **6. Enrollment** stage (Chapter 4).

---

## 4. Consultation stages

A consultation proceeds through **7 stages + consultation closed**. Each stage-advance button shows **only the permitted next stage(s)**,
and if the advance condition is not met an error appears and the stage does not change.

| # | Stage (label) | Internal code | What you input at this stage (summary) | Condition to advance to the next stage |
|---|-----------|-----------|------------------------------|---------------------|
| 1 | **접수 (Intake)** | `INTAKE` | Student/guardian info, school·grade, source, request type·purpose | (no condition) · anonymous cannot advance |
| 2 | **레벨테스트 (Level Test)** | `MAP_TEST` | Test fee status (paid/waived), scheduled test date·assigned teacher, scores (reading·math·language, etc.) | Has prior scores / test fee paid·waived / at least one score |
| 3 | **데모수업 (Demo Class)** | `TRIAL_CLASS` | Demo class scheduled date·assigned teacher, teacher feedback | At least one demo class registered |
| 4 | **등록 상담 (Enrollment Counseling)** | `ENROLLMENT_COUNSELING` | Course, number of sessions, tuition, class time, **teacher assignment**, enrollment counseling completed | "Enrollment counseling completed = YES" |
| 5 | **결제 (Payment)** | `PAYMENT` | Payment date·method·amount, **tuition payment completed (lead only)** | "Tuition payment completed" checked |
| 6 | **수강등록 (Enrollment)** | `CLASS_STARTED` | (no separate input — summary confirmation) | ⇒ On entry, **student·parent·accounts are auto-created** |
| 7 | **수강중 (Attending)** | `ATTENDING` | (no separate input) | Last forward stage |
| — | **상담종료 (Consultation Closed)** | `DROPPED` | Close reason (default: **simple inquiry end**) | Can be closed at any stage |

> For detailed input fields and validation rules of each stage, see [Consultation Management User Manual §2](MANUAL-260624-csl-consultation-userguide.md).
> **Note (label vs. behavior):** The label of stage 6 is "6. 수강등록 (Enrollment)", and pressing the **[수강등록완료]** (Complete Enrollment) button in the stage 6 panel
> moves the consultation to **7. 수강중 (Attending)**. The student/parent records are, however, **already created at the earlier "entry point" of stage 6** (see §5 below).

---

## 5. On entering stage 6 "Enrollment" — auto-registration (What happens at CLASS_STARTED)

The moment a consultation moves from **5. Payment → 6. Enrollment**, the system **automatically** performs the following
(no administrator action needed; a best-effort process that does not block the consultation transition even if it fails).

1. **Auto-create/match student** — Looks up an existing student by the consultation's student name+phone, and if none exists, creates a new one in Student Management (`/admin/std`) (status `ACTIVE`, start date=today, school·grade carried over).
2. **Auto-create/match parent + link** — If a guardian name exists, finds or creates a parent and **links it to the student** (the first guardian is designated as the primary guardian).
3. **Auto-prepare portal accounts** — Prepares the student and parent portal accounts.
   - **Parent**: Issued immediately with a random ID.
   - **Student**: Issued **only if an email exists**. An auto-created student has no email, so this step is **silently skipped** → the administrator issues it after entering the student's email (§6).
4. **Inherit level test scores** — Copies the MAP scores recorded in the consultation to the student record.
5. **[수강등록완료] (Complete Enrollment) button** — Once the above auto-registration links the student (`stdId`), the button becomes enabled, and clicking it transitions the consultation to **7. 수강중 (Attending)**. (Before the student is linked, it is disabled with "waiting for student auto-registration".)

> **Idempotency**: A consultation that already has a linked student is not registered again. It is safe to re-enter without worrying about duplicate creation.

---

## 6. Student registration · email · portal login issuance (Student account)

### 6.1 Student registration (`/admin/std`)

A student can be **auto-created** (§5) or **added directly** in Student Management. Rules on save:

| Item | Rule |
|------|------|
| **Email** | **Required** — cannot save without it (`EMAIL_REQUIRED`). Used as the student's portal login ID. |
| **Email duplicate** | **No duplicates** within the same academy (`EMAIL_DUPLICATE`, 409). Case-insensitive. |
| **Assigned teacher** | Not free text — **selected from the registered teacher list (`/admin/tch`)** (FK link). |
| Others | Name·English name·gender·date of birth·phone·school·grade·subject·status, etc. |

> The default list sort is **by most recent registration date**.
> Since an auto-created student has an empty email, **to open the portal for them the administrator must enter the email in the student detail**.

### 6.2 Issuing the student portal account

Issue it from the **"Portal Account" panel** on the student detail screen.

- If there is **no email**: a "can be issued after entering email" notice appears (`422 STUDENT_EMAIL_REQUIRED` on an issuance attempt).
- If there **is an email**: the account is issued with **login ID = student email** (lowercase).
- On issuance/re-issuance, a **temporary password (10 chars, letters+digits) is shown once** → copy it and hand it to the student/parent.
- On first login, a **password change is enforced** (`mustChangePassword`).
- If the password is forgotten, issue a new temporary password with **[비밀번호 재발급]** (Reissue Password) (this also releases any lock).

---

## 7. Parent registration · student linkage (Parent account & linkage)

### 7.1 How parents are created and linked

A parent is an **independent record**, linked to a student through a **link table** (not a field attached directly to the student).

- **Automatic** (§5): Created and linked from the consultation's guardian info (first guardian = primary).
- **Input within the student form**: On student registration/editing, link an existing parent from the guardian list or enter a new one (name·relationship·phone·email + primary flag).
- **Individual management**: A parent can also be registered standalone and then linked to/unlinked from a student, and the primary guardian can be designated.

Relationship characteristics:
- One student ↔ multiple guardians, one guardian ↔ multiple children (siblings) are possible.
- **The primary guardian is one per student** — designating a new primary automatically releases the previous one.

### 7.2 Parent portal account

- The parent account ID is a **randomly generated ID** (e.g., `p8k3m9`). (Unlike students, it is not email login.)
- Issuance/re-issuance, temporary password, and enforced first-time change are the same as for students (§6.2).

---

## 8. Teacher registration (Teacher registration) — administrator directly

Teachers are registered **directly by an administrator (ADMIN)** in Teacher Management (`/admin/tch`). (STAFF cannot register, only view.)

### 8.1 Input fields

| Item | Required | Description |
|------|:---:|------|
| Teacher name / English name | ✔ / | No duplicate name·English name within the academy |
| Email | ✔ | No duplicates within the academy |
| Phone · date of birth | | |
| Assigned subjects | | MAP / Math / Writing / Language Arts / SSAT / ISEE / International Admissions / Other (multiple) |
| Teacher flag · employment type | | Teacher/non-teacher distinction, full-time/part-time |
| Hire date · attendance number · memo | | |
| Status | | Active (ACTIVE) / Leave (LEAVE) / Resigned (RESIGNED) |

### 8.2 Issuing teacher login (console account)

- When registering a teacher, turn on the **"Create account" option** and set a password (8+ chars, letters+digits) to also create a **console login (`usr_role=TEACHER`)**.
- Afterward, from the teacher detail you can **reset the password / lock·unlock the account**.
- A **teacher portal account** (for portal viewing) is issued separately from the "Portal Account" panel (random ID).

### 8.3 AMA integration

- When creating a teacher, choosing a platform teacher via the **AMA user picker** auto-fills the name·email (link `tch_ama_user_id`).
- There is also a **manual input mode** for when AMA is unavailable.
- When saving the assigned teacher's schedule in consultation stages 2·3 (level test/demo class), the AMA teacher is also auto-upserted.

---

## 9. Teacher class scheduling · adding students (Class scheduling & roster)

A class (`/admin/cls`) is a unit that bundles **teacher + subject + student roster + weekly recurring schedule**.

### 9.1 Creating a class

Input in the class creation dialog:
- **Subject / course**
- **Assigned teacher** — Only `ACTIVE` teachers **who have a console account** can be selected (a class is linked to the teacher's console user).
- **Start date / end date / textbook·memo / hourly rate**
- **Add students** — Select **multiple students** to put into the class and designate **one representative student** among them (automatically shown as a group class if more than one).
- **Weekly recurring schedule (one or more)** — Weekday / start time / class duration (minutes) / class mode (in-person·online·2-person in-person).

On save, the class is created, and then **sessions (individual class occurrences) are auto-generated by the recurrence rule** (35 days by default). At this point, **time overlaps for the same teacher/student** are auto-detected and blocked.

### 9.2 An important distinction about adding students

There are **two kinds** of student↔class links, so don't confuse them.

| Category | What | How |
|------|------|--------|
| **Class roster** | The list of students actually taking the class. The basis for attendance·settlement | Add students **at class creation** (representative/group). *There is currently no separate button to add later to an existing class — the roster is finalized at creation* |
| **Enrollment** | A parent **requests** a class → the administrator **approves** it | Managed by request status `pending → confirmed/canceled` |

> The requirement's "teacher class scheduling → add students" is the **class roster** path.

---

## 10. Conducting the class

Items recorded by the teacher/administrator in each class session:

- **Attendance (attendance sheet)** — Per session, record student status (present / absent (reason) / late / left early) and recognized hours.
  Recording attendance automatically changes the **session to "held (HELD)"** and fills in the actual conducted time·minutes.
- **Class feedback (progress)** — Write progress, feedback, homework, weaknesses·improvements, and study plan (draft → submit → delivered to parent).
- **Make-up** — Plan/decide make-up sessions for absences/canceled classes.
- **Settlement** — Teacher settlement lines are aggregated from attendance × hourly rate.
- **Session management** — Reschedule / cancel / hold, and integration with a video link (Google Meet, etc.).

Students and parents can view only the sessions relevant to them in the **portal class schedule (calendar)** and check delivered feedback.

---

## 11. Portal login (Portal login) — common to students·parents·teachers

Portal login (`/portal/login`) requires all three: **academy code + ID + password** (multi-tenant isolation, PLN-260708).

```
┌───────────────────────────────────────┐
│         (Academy logo) TAC Portal      │
│  Academy code  [ tpi              ]    │ ← Auto-filled (fixed) if the login link has ?t=tpi
│  ID           [ student@example.com]   │ ← Student=email, parent·teacher=issued ID
│  Password     [ ••••••••          ]    │
│              [        Log in       ]   │
│  · Change your password on first login │
└───────────────────────────────────────┘
```

- **Academy code**: A short per-academy code (e.g., Trinity/TPI = `tpi`). Using the login link `…/portal/login?t=<code>` distributed by the administrator fills it in automatically.
- **ID**: Student = **their own email**, parent·teacher = **issued random ID**.
- **Password**: The **temporary password** issued by the administrator → **changed on first login**.
- After logging in, you don't need to enter the academy code again (the token includes academy info).
- **Security**: A wrong academy code, ID, or password are **all handled with the same error message** so that account existence is not exposed. When an account is locked, a "please contact your academy" notice is shown.

---

## 12. Permissions

| Action | Allowed |
|------|------|
| View·create·edit consultations, forward stages, level test/demo/enrollment input | Logged-in operator (their academy) |
| **Confirm tuition payment completed** | **ADMIN / APP_ADMIN** (lead) |
| **Reverse stage transition** (reason required) | **ADMIN / APP_ADMIN** |
| **Register·edit·delete teachers, lock/unlock teacher accounts** | **ADMIN** |
| Import AMA teachers | STAFF / ADMIN |
| Student registration·email·portal account issuance/re-issuance | Operator (issuance/re-issuance API is ADMIN/APP_ADMIN) |
| Class creation·session·attendance·feedback | Logged-in operator·teacher (their academy) |
| Portal viewing (notices·schedule·resources) | Only one's own relevant scope (student/parent/teacher portal account) |

---

## 13. Troubleshooting

| Symptom | Cause / resolution |
|------|-------------|
| [수강등록완료] (Complete Enrollment) button is disabled | Student auto-registration hasn't happened yet. Check that the consultation's student info (name/phone) is valid and not anonymous. |
| "Email already in use" when saving a student | A student with the same email exists in the same academy (no duplicates). Use a different email. |
| Cannot issue the student portal account | The student's **email is empty**. Enter the email in the student detail, then issue. |
| Portal won't open for an auto-created student | The auto student has no email → administrator enters the email, then [Issue]. |
| Teacher not in the list when creating a class | That teacher has **no console account (TEACHER)**. Check whether an account was created at teacher registration. |
| Cannot add a student to an existing class | The roster is finalized **at class creation** (currently no add button). Compose a new class or use the enrollment approval path. |
| Portal login fails (cause unknown) | For security, code/ID/password errors show the same message. Re-check the **academy code** and ID (student=email). |
| STAFF blocked from registering a teacher | Teacher master registration is possible **only by ADMIN**. |

---

## 14. Appendix — code/status mapping (Reference)

**Consultation stages**

| Label (UI) | Code |
|----------|------|
| 1. 접수 (Intake) | `INTAKE` |
| 2. 레벨테스트 (Level Test) | `MAP_TEST` |
| 3. 데모수업 (Demo Class) | `TRIAL_CLASS` |
| 4. 등록 상담 (Enrollment Counseling) | `ENROLLMENT_COUNSELING` |
| 5. 결제 (Payment) | `PAYMENT` |
| 6. 수강등록 (Enrollment) | `CLASS_STARTED` |
| 7. 수강중 (Attending) | `ATTENDING` |
| 상담종료 (Consultation Closed) | `DROPPED` |

**Consultation close reasons**: Simple inquiry end (`SIMPLE_INQUIRY_END`, default) · academy-side cancellation · student health · student schedule change · payment declined · enrolled at another academy · other

**Console roles**: `ADMIN` · `TEACHER` · `STAFF` · `APP_ADMIN`
**Portal kinds**: `STUDENT` · `PARENT` · `TEACHER`

**Session status**: Scheduled (`SCHEDULED`) · Held (`HELD`) · Cancelled (`CANCELLED`) · Rescheduled (`RESCHEDULED`) · No-show (`NO_SHOW`) · Make-up replacement (`MAKEUP_REPLACEMENT`)
**Attendance status**: Present (`PRESENT`) · Absent-excused (`ABSENT_EXCUSED`) · Absent-unexcused (`ABSENT_UNEXCUSED`) · Late (`LATE`) · Left early (`LEFT_EARLY`)

---

_This manual is based on the 2026-07-14 implementation (PLN-260714). For screen and input details of the 6 consultation stages, also see [MANUAL-260624](MANUAL-260624-csl-consultation-userguide.md)._
