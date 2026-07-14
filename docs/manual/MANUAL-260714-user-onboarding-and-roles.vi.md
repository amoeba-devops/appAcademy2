---
document_id: MANUAL-USERS-260714-VI
version: 1.0.0
status: active
created: 2026-07-14
authors:
  - gray.kim@amoeba.group
audience: 학원 운영자 / 관리자(ADMIN·STAFF) — 사용자 계정·역할 운영 담당
source_of_truth:
  - backend/src/modules/acm-csl/application/csl-enrollment-registration.service.ts (CLASS_STARTED 자동등록)
  - backend/src/modules/acm-auth/application/portal-account.service.ts (포털 계정 발급/로그인)
  - backend/src/modules/acm-std/application/student.service.ts (학생 이메일 필수/중복)
  - backend/src/modules/acm-std/application/parent.service.ts (학부모 연결)
  - backend/src/modules/acm-tch/application/teacher.service.ts (강사 등록)
  - backend/src/modules/acm-cls/** (수업/세션/출석)
related:
  - docs/manual/MANUAL-260624-csl-consultation-userguide.md (상담 6단계 상세)
  - docs/plan/PLN-260706-acm-portal-accounts-and-role-portals.md
  - docs/plan/PLN-260708-portal-tenant-scoped-login.md
  - docs/plan/PLN-260714-csl-std-enrollment-portal.md
---

# Hướng dẫn đăng ký người dùng và phân quyền (User Onboarding & Roles Manual)

> Tài liệu này mô tả toàn bộ quá trình từ khi học sinh · phụ huynh gửi đăng ký tư vấn qua trang web,
> đi qua **tư vấn → đăng ký khóa học → đang học**, cho đến khi **học sinh · phụ huynh · giảng viên mỗi bên có tài khoản riêng**.
> Các mục nhập chi tiết của 6 giai đoạn tư vấn xem tại [Hướng dẫn sử dụng quản lý tư vấn](MANUAL-260624-csl-consultation-userguide.md);
> tài liệu này tập trung vào **việc tạo tài khoản và phân quyền**. Nhãn màn hình dựa theo UI thực tế (tiếng Hàn).

---

## 0. Hai hệ thống tài khoản (Two account systems) — cần hiểu trước tiên

TAC có **hai loại đăng nhập với tính chất khác nhau**. Cần phân biệt trước để tránh nhầm lẫn.

| Phân loại | Tài khoản console vận hành (Admin/Console) | Tài khoản cổng thông tin (Portal) |
|------|-------------------------------|--------------------|
| Vị trí đăng nhập | Console vận hành `/admin/*` | Cổng thông tin `/portal/login` |
| Bảng | `amb_acm_user` | `amb_acm_portal_account` |
| Đối tượng | **Quản trị viên · Giảng viên · Nhân viên** | **Học sinh · Phụ huynh · Giảng viên** |
| Giá trị vai trò | `ADMIN` / `TEACHER` / `STAFF` / `APP_ADMIN` | `STUDENT` / `PARENT` / `TEACHER` |
| Công dụng | Vận hành học viện, tư vấn, quản lý lớp học | Xem thông báo, lịch học, thư viện tài liệu |

- **Giảng viên có thể có cả hai tài khoản.** Đăng nhập console (quản lý lớp/điểm danh) và đăng nhập cổng thông tin (xem cổng thông tin) là hai thứ riêng biệt.
- **Học sinh · phụ huynh chỉ có tài khoản cổng thông tin** (không đăng nhập vào console vận hành).
- Toàn bộ tài khoản · dữ liệu được **cô lập theo đơn vị học viện (tenant)**. Tài khoản của học viện khác không hiển thị.

---

## 1. Toàn bộ luồng trong một cái nhìn (End-to-end flow)

```
[Đăng ký tư vấn web]      [Console vận hành — Quản lý tư vấn /admin/csl]              [Cấp tài khoản]
Form trang chủ    ─▶   1.접수 → 2.레벨테스트 → 3.데모수업 → 4.등록상담 → 5.결제
(HS/PH nhập)                                                          │
                                                                     ▼ Khi vào 6.수강등록
                                                        ┌─────────────────────────────┐
                                                        │ Tự tạo học sinh (Quản lý HS /admin/std)│
                                                        │ Tự tạo phụ huynh + liên kết vào HS     │
                                                        │ Tự chuẩn bị TK cổng cho HS·PH          │
                                                        │ Kế thừa điểm level test cho học sinh    │
                                                        └─────────────────────────────┘
                                                                     │ Nút [수강등록완료]
                                                                     ▼
                                                                7.수강중

[Giảng viên] Quản trị viên đăng ký trực tiếp (/admin/tch) ─▶ [Đăng ký lịch học /admin/cls: giảng viên·môn·thứ·giờ + thêm học sinh]
                                                          ─▶ [Tiến hành giảng dạy: ghi điểm danh·phản hồi theo buổi]
```

**Tóm tắt quy tắc cốt lõi trong một dòng**
- Tài khoản học sinh · phụ huynh được tạo **tự động** khi tư vấn đạt đến **6. 수강등록 (đăng ký khóa học)** (quản trị viên không cần tạo thủ công).
- Giảng viên do **quản trị viên đăng ký trực tiếp** (không tạo tự động).
- Đăng nhập cổng thông tin luôn cần đủ 3 yếu tố: **(mã học viện + ID + mật khẩu)**.

---

## 2. Loại người dùng và vai trò (User types & roles)

### 2.1 Bảng tóm tắt vai trò

| Người dùng | Hệ thống tài khoản | Vai trò/loại | Chủ thể tạo tài khoản | Quyền chính |
|--------|-----------|-----------|----------------|-----------|
| **Quản trị viên (viện trưởng/người phụ trách)** | Console | `ADMIN` | Liên kết AMA / seed ban đầu | Toàn bộ chức năng. Đăng ký·sửa·xóa giảng viên, xác nhận nộp học phí, chuyển ngược giai đoạn, cấp tài khoản cổng |
| **Nhân viên (staff không chủ nhiệm)** | Console | `STAFF` | Quản trị viên | Dùng màn hình tư vấn·lớp học, nhập giảng viên từ AMA. **Không thể đăng ký/sửa master giảng viên** |
| **Giảng viên** | Console (tùy chọn) + Portal (tùy chọn) | Console `TEACHER` / Portal `TEACHER` | Quản trị viên (khi đăng ký giảng viên) | Tiến hành lớp phụ trách, ghi điểm danh·phản hồi, viết phản hồi buổi học demo. Không quản lý được master giảng viên |
| **Học sinh** | Portal | `STUDENT` | **Tự động** (6.수강등록) hoặc nhập thủ công ở Quản lý HS | Xem thông báo·lịch học·thư viện tài liệu tại cổng |
| **Phụ huynh** | Portal | `PARENT` | **Tự động** (6.수강등록) hoặc nhập thủ công ở Quản lý HS | Xem thông báo·lịch liên quan đến con tại cổng, đăng ký lớp |
| (Người vận hành nền tảng) | Console | `APP_ADMIN` | Nền tảng AMA | Quản lý hệ thống/tenant (cài đặt mã học viện v.v.) |

> Vai trò console được suy ra từ cấp bậc trên nền tảng AMA: MASTER/OWNER/MANAGER → **ADMIN**, jobRole=TEACHER → **TEACHER**, còn lại → **STAFF**.

### 2.2 Chi tiết vai trò của từng người dùng

- **Học sinh (STUDENT)** — học sinh đang theo học. Tại cổng thông tin xem các thông báo·lịch học (lịch)·thư viện tài liệu **liên quan đến bản thân**. ID đăng nhập là **email của chính học sinh**.
- **Phụ huynh (PARENT)** — người giám hộ của học sinh. Một học sinh có thể có nhiều người giám hộ, một người giám hộ có thể có nhiều con, và **một người giám hộ đại diện (primary)** được chỉ định. Tại cổng có thể xem thông tin liên quan đến con và đăng ký lớp học.
- **Giảng viên (TEACHER)** — do quản trị viên đăng ký trực tiếp. Ghi lịch·điểm danh·phản hồi (tiến độ) của lớp phụ trách, và viết phản hồi buổi học demo trong pipeline tư vấn. **Danh sách giảng viên (master) chỉ quản trị viên** mới quản lý.

---

## 3. Đăng ký tư vấn qua trang web (Public intake) — điểm khởi đầu của tài khoản

Học sinh · phụ huynh bắt đầu từ **form công khai trên trang chủ**. Có hai loại, khi được tiếp nhận sẽ
**được xếp thành tư vấn mới ở trạng thái 1. 접수 (tiếp nhận)** tại Quản lý tư vấn (`/admin/csl`) của console vận hành.

| Form | Màn hình | Mục nhập chính | Kết quả tiếp nhận |
|----|------|-----------|-----------|
| **Đăng ký tư vấn** | `/web/contact` | Tên·khối lớp học sinh / **Tên·điện thoại giám hộ (bắt buộc)** / Mục đích tư vấn (nhiều) | Nguồn=trang chủ, loại đăng ký=chỉ tư vấn |
| **Đăng ký level test (MAP)** | `/web/test` | Tên tiếng Hàn·Anh·ngày sinh·giới tính học sinh / Tên·điện thoại·email giám hộ / Quốc gia·thành phố dự thi | Nguồn=trang chủ, loại đăng ký=chỉ thi |

> Ở bước này **chưa tạo tài khoản học sinh/phụ huynh.** Việc tiếp nhận chỉ tồn tại dưới dạng "hồ sơ tư vấn",
> còn bản ghi học sinh · phụ huynh thực tế và tài khoản cổng được tạo ở bước **6. 수강등록** (chương 4).

---

## 4. Nhập liệu theo từng giai đoạn tư vấn mới (Consultation stages)

Tư vấn tiến hành theo **7 giai đoạn + kết thúc tư vấn**. Mỗi nút chuyển giai đoạn chỉ hiển thị **giai đoạn kế tiếp được cho phép**,
và nếu chưa đủ điều kiện tiến hành thì hiện lỗi và không đổi giai đoạn.

| # | Giai đoạn (nhãn) | Mã nội bộ | Nội dung nhập ở giai đoạn này (tóm tắt) | Điều kiện chuyển giai đoạn kế |
|---|-----------|-----------|------------------------------|---------------------|
| 1 | **접수** (tiếp nhận) | `INTAKE` | Thông tin học sinh/giám hộ, trường·khối lớp, nguồn tiếp cận, loại·mục đích đăng ký | (không điều kiện) · ẩn danh không thể tiến hành |
| 2 | **레벨테스트** (level test) | `MAP_TEST` | Trạng thái phí thi (nộp/miễn), ngày dự thi·giảng viên phụ trách, điểm (đọc·toán·ngôn ngữ v.v.) | Có điểm trước đó / phí thi đã nộp·miễn / có ít nhất 1 điểm |
| 3 | **데모수업** (buổi học demo) | `TRIAL_CLASS` | Ngày dự kiến·giảng viên phụ trách buổi demo, phản hồi giảng viên | Đăng ký ít nhất 1 buổi demo |
| 4 | **등록 상담** (tư vấn ghi danh) | `ENROLLMENT_COUNSELING` | Khóa học, số buổi, học phí, giờ học, **phân công giảng viên**, hoàn tất tư vấn ghi danh | "Hoàn tất tư vấn ghi danh = YES" |
| 5 | **결제** (thanh toán) | `PAYMENT` | Ngày·phương thức·số tiền thanh toán, **hoàn tất nộp học phí (chỉ người phụ trách)** | Tích "Hoàn tất nộp học phí" |
| 6 | **수강등록** (đăng ký khóa học) | `CLASS_STARTED` | (không nhập riêng — xác nhận tóm tắt) | ⇒ Khi vào **tự tạo học sinh·phụ huynh·tài khoản** |
| 7 | **수강중** (đang học) | `ATTENDING` | (không nhập riêng) | Giai đoạn tiến thuận cuối cùng |
| — | **상담종료** (kết thúc tư vấn) | `DROPPED` | Lý do kết thúc (mặc định: **단순문의종료** — kết thúc do chỉ hỏi thăm) | Có thể kết thúc ở bất kỳ giai đoạn nào |

> Mục nhập chi tiết·quy tắc kiểm tra của từng giai đoạn xem tại [Hướng dẫn sử dụng quản lý tư vấn §2](MANUAL-260624-csl-consultation-userguide.md).
> **Lưu ý (nhãn vs hành vi):** Nhãn của giai đoạn 6 là "6. 수강등록", và khi nhấn nút **[수강등록완료]** (hoàn tất đăng ký khóa học) trong panel giai đoạn 6,
> tư vấn sẽ chuyển sang **7. 수강중**. Bản ghi học sinh · phụ huynh **đã được tạo từ trước tại "thời điểm bước vào" giai đoạn 6** (xem §5 dưới đây).

---

## 5. Khi vào giai đoạn 6 "수강등록" — Đăng ký tự động (What happens at CLASS_STARTED)

Ngay khoảnh khắc tư vấn chuyển từ **5. 결제 → 6. 수강등록**, hệ thống **tự động** thực hiện các việc sau
(quản trị viên không cần thao tác, xử lý best-effort — dù thất bại cũng không chặn việc chuyển giai đoạn tư vấn).

1. **Tự tạo/khớp học sinh** — tìm học sinh hiện có bằng tên+điện thoại của học sinh trong tư vấn, nếu không có thì tạo mới ở Quản lý HS (`/admin/std`) (trạng thái `ACTIVE`, ngày bắt đầu=hôm nay, chuyển trường·khối lớp sang).
2. **Tự tạo/khớp phụ huynh + liên kết** — nếu có tên giám hộ thì tìm hoặc tạo phụ huynh, và **liên kết vào học sinh** (giám hộ đầu tiên được chỉ định làm giám hộ đại diện).
3. **Tự chuẩn bị tài khoản cổng** — chuẩn bị tài khoản cổng cho học sinh·phụ huynh.
   - **Phụ huynh**: cấp ngay với ID ngẫu nhiên.
   - **Học sinh**: **phải có email** mới cấp được. Học sinh tạo tự động không có email nên ở bước này **âm thầm bỏ qua** → quản trị viên nhập email học sinh rồi mới cấp (§6).
4. **Kế thừa điểm level test** — sao chép điểm MAP đã ghi trong tư vấn sang bản ghi học sinh.
5. **Nút [수강등록완료]** — khi học sinh được liên kết (`stdId`) qua đăng ký tự động ở trên thì nút được kích hoạt, và khi nhấn sẽ chuyển tư vấn sang **7. 수강중**. (Trước khi liên kết học sinh, nút bị vô hiệu với trạng thái "đang chờ tự động đăng ký học sinh")

> **Tính idempotent**: Tư vấn đã liên kết học sinh sẽ không đăng ký lại. An toàn khi vào lại mà không lo tạo trùng.

---

## 6. Đăng ký học sinh · Email · Cấp đăng nhập cổng (Student account)

### 6.1 Đăng ký học sinh (`/admin/std`)

Học sinh có thể được **tạo tự động** (§5) hoặc **thêm trực tiếp** tại Quản lý HS. Quy tắc khi lưu:

| Mục | Quy tắc |
|------|------|
| **Email** | **Bắt buộc** — không có thì không lưu được (`EMAIL_REQUIRED`). Dùng làm ID đăng nhập cổng của học sinh. |
| **Trùng email** | **Không được trùng** trong cùng học viện (`EMAIL_DUPLICATE`, 409). Không phân biệt hoa/thường. |
| **Giảng viên phụ trách** | Không nhập tự do mà **chọn từ danh sách giảng viên đã đăng ký (`/admin/tch`)** (liên kết FK). |
| Khác | Tên·tên tiếng Anh·giới tính·ngày sinh·điện thoại·trường·khối lớp·môn·trạng thái v.v. |

> Sắp xếp mặc định của danh sách là **theo ngày đăng ký mới nhất**.
> Học sinh tạo tự động có email trống, nên **để mở cổng cho học sinh, quản trị viên phải nhập email ở trang chi tiết học sinh**.

### 6.2 Cấp tài khoản cổng cho học sinh

Cấp tại **panel "포털 계정" (tài khoản cổng)** trên màn hình chi tiết học sinh.

- Nếu **không có** email: hiện hướng dẫn "이메일 입력 후 발급 가능" (có thể cấp sau khi nhập email) (khi thử cấp sẽ báo `422 STUDENT_EMAIL_REQUIRED`).
- Nếu **có** email: cấp tài khoản với **ID đăng nhập = email học sinh** (chữ thường).
- Khi cấp/cấp lại, **mật khẩu tạm (10 ký tự, chữ+số) hiển thị 1 lần** → sao chép và chuyển cho học sinh/phụ huynh.
- Khi đăng nhập lần đầu, **bắt buộc đổi mật khẩu** (`mustChangePassword`).
- Nếu quên mật khẩu, dùng **[비밀번호 재발급]** (cấp lại mật khẩu) để cấp mật khẩu tạm mới (cũng mở khóa luôn).

---

## 7. Đăng ký phụ huynh · Liên kết học sinh (Parent account & linkage)

### 7.1 Cách tạo và liên kết phụ huynh

Phụ huynh là **bản ghi độc lập**, và được nối với học sinh qua **bảng liên kết** (không phải trường gắn trực tiếp vào học sinh).

- **Tự động** (§5): tạo·liên kết bằng thông tin giám hộ trong tư vấn (giám hộ đầu tiên = đại diện).
- **Nhập trong form học sinh**: khi đăng ký/sửa học sinh, liên kết phụ huynh hiện có từ danh sách giám hộ hoặc nhập mới (tên·quan hệ·điện thoại·email + có phải đại diện hay không).
- **Quản lý riêng**: có thể đăng ký phụ huynh độc lập rồi liên kết/gỡ khỏi học sinh, và chỉ định giám hộ đại diện.

Đặc điểm quan hệ:
- Một học sinh ↔ nhiều giám hộ, một giám hộ ↔ nhiều con (anh·chị·em) đều được.
- **Giám hộ đại diện (primary) chỉ 1 người mỗi học sinh** — khi chỉ định đại diện mới, đại diện cũ tự động bị gỡ.

### 7.2 Tài khoản cổng của phụ huynh

- ID tài khoản phụ huynh là **ID tạo ngẫu nhiên** (ví dụ `p8k3m9`). (Khác học sinh, không đăng nhập bằng email)
- Cấp/cấp lại·mật khẩu tạm·bắt buộc đổi lần đầu giống hệt học sinh (§6.2).

---

## 8. Đăng ký giảng viên (Teacher registration) — Quản trị viên trực tiếp

Giảng viên do **quản trị viên (ADMIN) trực tiếp** đăng ký tại Quản lý giảng viên (`/admin/tch`). (Nhân viên STAFF không đăng ký được, chỉ xem)

### 8.1 Mục nhập

| Mục | Bắt buộc | Mô tả |
|------|:---:|------|
| Tên giảng viên / Tên tiếng Anh | ✔ / | Không được trùng tên·tên tiếng Anh trong học viện |
| Email | ✔ | Không được trùng trong học viện |
| Điện thoại · Ngày sinh | | |
| Môn phụ trách | | MAP / Toán / Writing / Language Arts / SSAT / ISEE / Tuyển sinh quốc tế / Khác (nhiều) |
| Có phải giảng viên · Hình thức tuyển dụng | | Phân biệt giảng viên/không giảng viên, chính thức/bán thời gian |
| Ngày vào làm · Mã điểm danh · Ghi chú | | |
| Trạng thái | | Đang làm (ACTIVE) / Nghỉ phép (LEAVE) / Nghỉ việc (RESIGNED) |

### 8.2 Cấp đăng nhập giảng viên (tài khoản console)

- Khi đăng ký giảng viên, bật **tùy chọn "계정 생성" (tạo tài khoản)** và chỉ định mật khẩu (từ 8 ký tự, chữ+số) thì **đăng nhập console (`usr_role=TEACHER`)** cũng được tạo cùng.
- Sau đó tại chi tiết giảng viên có thể **đặt lại mật khẩu / khóa·mở khóa tài khoản**.
- **Tài khoản cổng giảng viên** (để xem cổng) được cấp riêng tại panel "포털 계정" (tài khoản cổng) (ID ngẫu nhiên).

### 8.3 Liên kết AMA

- Khi tạo giảng viên, dùng **bộ chọn người dùng AMA** để chọn giáo viên nền tảng thì tên·email tự động được điền (liên kết `tch_ama_user_id`).
- Cũng có **chế độ nhập thủ công** cho trường hợp AMA không khả dụng.
- Khi lưu lịch giảng viên phụ trách ở giai đoạn 2·3 (level test/buổi demo), giảng viên AMA cũng được tự động upsert.

---

## 9. Đăng ký lịch học của giảng viên · Thêm học sinh (Class scheduling & roster)

Lớp học (`/admin/cls`) là một đơn vị gộp **giảng viên + môn + danh sách học sinh + lịch lặp hàng tuần**.

### 9.1 Tạo lớp học

Nhập trong hộp thoại tạo lớp học:
- **Môn / Khóa học**
- **Giảng viên phụ trách** — chỉ chọn được **giảng viên có tài khoản console** trong số giảng viên `ACTIVE` (lớp học liên kết với người dùng console của giảng viên).
- **Ngày khai giảng / Ngày kết thúc / Giáo trình·ghi chú / Lương theo giờ**
- **Thêm học sinh** — **chọn nhiều** học sinh để đưa vào lớp và chỉ định **1 học sinh đại diện** trong đó (nếu quá 1 người thì tự đánh dấu là lớp nhóm).
- **Lịch lặp hàng tuần (1 trở lên)** — thứ / giờ bắt đầu / thời lượng buổi (phút) / hình thức học (trực tiếp·online·2 người trực tiếp).

Khi lưu, lớp học được tạo và tiếp đó **các buổi (session — từng lần học riêng lẻ) tự động sinh theo quy tắc lặp** (mặc định 35 ngày). Lúc này **sự trùng giờ của cùng giảng viên/học sinh** được tự động phát hiện và chặn.

### 9.2 Phân biệt quan trọng về việc thêm học sinh

Liên kết học sinh↔lớp học có **hai loại**, đừng nhầm lẫn.

| Phân loại | Là gì | Làm thế nào |
|------|------|--------|
| **Danh sách lớp (roster)** | Danh sách học sinh thực sự học lớp đó. Cơ sở để điểm danh·quyết toán | Thêm học sinh **khi tạo lớp** (đại diện/nhóm). *Hiện chưa có nút riêng để thêm sau vào lớp đã có — danh sách được chốt khi tạo* |
| **Đăng ký học (enrollment)** | Phụ huynh **đăng ký** vào lớp → quản trị viên **duyệt** | Quản lý trạng thái đăng ký `chờ → xác nhận/hủy` |

> "Đăng ký lịch học của giảng viên → thêm học sinh" trong yêu cầu là đường **danh sách lớp (roster)**.

---

## 10. Tiến hành giảng dạy (Conducting the class)

Các mục giảng viên/quản trị viên ghi lại trong từng buổi học:

- **Điểm danh (sổ điểm danh)** — ghi trạng thái học sinh theo từng buổi (có mặt / vắng (lý do) / muộn / về sớm) và số tiết được công nhận.
  Khi ghi điểm danh, **buổi tự động chuyển sang "진행완료 (HELD)"** (đã tiến hành xong) và điền thời điểm·số phút tiến hành thực tế.
- **Phản hồi buổi học (tiến độ)** — viết tiến độ, phản hồi, bài tập, điểm yếu·phát triển, kế hoạch học tập (nháp → gửi → chuyển cho phụ huynh).
- **Học bù** — lập kế hoạch·quyết định buổi học bù cho việc vắng/nghỉ dạy.
- **Quyết toán** — dòng quyết toán giảng viên được tổng hợp theo điểm danh × lương giờ.
- **Quản lý buổi** — đổi lịch (reschedule) / hủy (cancel) / tiến hành (hold), liên kết link video (Google Meet v.v.).

Học sinh · phụ huynh chỉ xem các buổi liên quan đến bản thân tại **lịch học cổng thông tin (lịch)** và có thể xem phản hồi đã được chuyển tới.

---

## 11. Cách đăng nhập cổng thông tin (Portal login) — chung cho học sinh·phụ huynh·giảng viên

Đăng nhập cổng (`/portal/login`) cần đủ 3 yếu tố: **mã học viện + ID + mật khẩu** (cô lập multi-tenant, PLN-260708).

```
┌───────────────────────────────────┐
│         (Logo học viện) Cổng TAC   │
│  Mã học viện [ tpi              ]   │ ← Nếu link đăng nhập có ?t=tpi thì tự điền (cố định)
│  ID         [ student@example.com] │ ← HS=email, PH·giảng viên=ID được cấp
│  Mật khẩu   [ ••••••••          ]   │
│          [        Đăng nhập      ]  │
│  · Khi đăng nhập lần đầu sẽ đổi mật khẩu │
└───────────────────────────────────┘
```

- **Mã học viện**: mã ngắn của mỗi học viện (ví dụ Trinity/TPI = `tpi`). Nếu dùng link đăng nhập do quản trị viên phát hành `…/portal/login?t=<mã>` thì tự động được điền.
- **ID**: học sinh = **email của chính mình**, phụ huynh·giảng viên = **ID ngẫu nhiên được cấp**.
- **Mật khẩu**: **mật khẩu tạm** do quản trị viên cấp → **đổi khi đăng nhập lần đầu**.
- Sau khi đăng nhập không cần nhập lại mã học viện (thông tin học viện đã nằm trong token).
- **Bảo mật**: mã học viện·ID·mật khẩu sai đều được xử lý bằng **cùng một thông báo lỗi** để không lộ việc tài khoản có tồn tại hay không. Khi tài khoản bị khóa sẽ hiện hướng dẫn "학원에 문의하세요" (vui lòng liên hệ học viện).

---

## 12. Tóm tắt phân quyền (Permissions)

| Tác vụ | Được phép |
|------|------|
| Xem·tạo·sửa tư vấn, tiến thuận giai đoạn, nhập level test/demo/ghi danh | Người vận hành đã đăng nhập (học viện tương ứng) |
| **Xác nhận hoàn tất nộp học phí** | **ADMIN / APP_ADMIN** (người phụ trách) |
| **Chuyển ngược giai đoạn** (bắt buộc có lý do) | **ADMIN / APP_ADMIN** |
| **Đăng ký·sửa·xóa giảng viên, khóa/mở khóa tài khoản giảng viên** | **ADMIN** |
| Nhập giảng viên từ AMA | STAFF / ADMIN |
| Đăng ký học sinh·email·cấp/cấp lại tài khoản cổng | Người vận hành (API cấp/cấp lại là ADMIN/APP_ADMIN) |
| Tạo lớp·buổi·điểm danh·phản hồi | Người vận hành·giảng viên đã đăng nhập (học viện tương ứng) |
| Xem cổng (thông báo·lịch·thư viện tài liệu) | Chỉ phạm vi liên quan bản thân (tài khoản cổng học sinh/phụ huynh/giảng viên) |

---

## 13. Các vấn đề thường gặp (Troubleshooting)

| Triệu chứng | Nguyên nhân / Cách xử lý |
|------|-------------|
| Nút [수강등록완료] bị vô hiệu | Học sinh chưa được tự động đăng ký. Kiểm tra thông tin học sinh trong tư vấn (tên/điện thoại) có hợp lệ, có phải ẩn danh không. |
| Khi lưu học sinh báo "이미 사용 중인 이메일" (email đã được sử dụng) | Đã có học sinh cùng email trong học viện (không được trùng). Dùng email khác. |
| Không cấp được tài khoản cổng học sinh | **Email học sinh đang trống**. Nhập email ở chi tiết học sinh rồi cấp. |
| Không mở được cổng cho học sinh tạo tự động | Học sinh tự động không có email → quản trị viên nhập email rồi [발급] (cấp). |
| Khi tạo lớp không thấy giảng viên trong danh sách | Giảng viên đó **không có tài khoản console (TEACHER)**. Kiểm tra có tạo tài khoản khi đăng ký giảng viên không. |
| Không thêm được học sinh vào lớp đã có | Danh sách được chốt **khi tạo lớp** (hiện chưa có nút thêm). Lập lớp mới hoặc dùng đường duyệt đăng ký học. |
| Đăng nhập cổng thất bại (không rõ nguyên nhân) | Vì lý do bảo mật, lỗi mã/ID/mật khẩu đều cùng một thông báo. Kiểm tra lại **mã học viện** và ID (HS=email). |
| STAFF định đăng ký giảng viên nhưng bị chặn | Đăng ký master giảng viên **chỉ ADMIN** mới được. |

---

## 14. Phụ lục — Ánh xạ mã/trạng thái (Reference)

**Giai đoạn tư vấn**

| Nhãn (UI) | Mã |
|----------|------|
| 1. 접수 (tiếp nhận) | `INTAKE` |
| 2. 레벨테스트 (level test) | `MAP_TEST` |
| 3. 데모수업 (buổi học demo) | `TRIAL_CLASS` |
| 4. 등록 상담 (tư vấn ghi danh) | `ENROLLMENT_COUNSELING` |
| 5. 결제 (thanh toán) | `PAYMENT` |
| 6. 수강등록 (đăng ký khóa học) | `CLASS_STARTED` |
| 7. 수강중 (đang học) | `ATTENDING` |
| 상담종료 (kết thúc tư vấn) | `DROPPED` |

**Lý do kết thúc tư vấn**: 단순문의종료 — kết thúc do chỉ hỏi thăm (`SIMPLE_INQUIRY_END`, mặc định) · Hủy do phía học viện · Sức khỏe học sinh · Học sinh đổi lịch · Từ chối thanh toán · Ghi danh học viện khác · Khác

**Vai trò console**: `ADMIN` · `TEACHER` · `STAFF` · `APP_ADMIN`
**Loại cổng**: `STUDENT` · `PARENT` · `TEACHER`

**Trạng thái buổi**: 예정 — dự kiến (`SCHEDULED`) · 진행완료 — đã tiến hành xong (`HELD`) · 취소 — đã hủy (`CANCELLED`) · 일정변경 — đổi lịch (`RESCHEDULED`) · 노쇼 — không đến (`NO_SHOW`) · 보강대체 — thay bằng học bù (`MAKEUP_REPLACEMENT`)
**Trạng thái điểm danh**: 출석 — có mặt (`PRESENT`) · 결석-사유 — vắng có lý do (`ABSENT_EXCUSED`) · 결석-무단 — vắng không phép (`ABSENT_UNEXCUSED`) · 지각 — muộn (`LATE`) · 조퇴 — về sớm (`LEFT_EARLY`)

---

_Tài liệu này dựa theo bản triển khai ngày 2026-07-14 (PLN-260714). Chi tiết màn hình·nhập liệu của 6 giai đoạn tư vấn xin tham khảo thêm [MANUAL-260624](MANUAL-260624-csl-consultation-userguide.md)._
