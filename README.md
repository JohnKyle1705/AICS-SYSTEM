# AICS Request Management & Beneficiary Information System
### Municipality of Daanbantayan — MSWD

---

## Project Structure

```
├── supabase/
│   └── schema.sql              # Full database schema
├── web/                        # Next.js 15 web application
│   └── src/
│       ├── app/
│       │   ├── login/          # Login page
│       │   ├── (protected)/
│       │   │   ├── dashboard/
│       │   │   ├── beneficiaries/
│       │   │   ├── requests/
│       │   │   ├── assessments/
│       │   │   ├── payouts/
│       │   │   ├── reports/
│       │   │   ├── notifications/
│       │   │   └── users/
│       │   └── api/users/      # Admin user creation API
│       ├── components/
│       ├── lib/
│       └── types/
└── mobile/                     # React Native Expo app
    └── src/
        ├── screens/
        ├── navigation/
        ├── lib/
        └── types/
```

---

## Setup Instructions

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. Go to **Storage** → Create bucket named `documents` (Private)
4. Copy your **Project URL**, **Anon Key**, and **Service Role Key**

### 2. Web App Setup

```bash
cd web
cp .env.local.example .env.local
# Fill in your Supabase credentials in .env.local
npm install
npm run dev
```

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Mobile App Setup

```bash
cd mobile
cp .env.example .env
# Fill in your Supabase credentials in .env
npm install
npx expo start
```

`.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Scan the QR code with **Expo Go** app on your phone.

### 4. Create First Admin User

1. Go to Supabase **Authentication** → **Users** → **Add User**
2. Enter email and password
3. Go to **Table Editor** → `profiles` → Insert row:
   - `id`: (paste the user's UUID from auth)
   - `full_name`: Admin Name
   - `role`: `admin`

---

## Features

| Module | Web | Mobile |
|--------|-----|--------|
| Login / Auth | ✅ | ✅ |
| Dashboard | ✅ | ✅ |
| Beneficiary Management | ✅ CRUD | ✅ CRUD |
| AICS Requests | ✅ Full | ✅ Encode + View |
| Document Upload | ✅ | — |
| Assessment | ✅ | ✅ |
| Payout Tracking | ✅ | — |
| Reports (PDF/Excel) | ✅ | — |
| Notifications | ✅ | ✅ |
| User Management | ✅ Admin only | — |

## Roles

| Role | Permissions |
|------|-------------|
| Admin | Full access + user management |
| Staff | All modules except user management |
| Encoder | Encode requests and beneficiaries |

## Tech Stack

- **Web**: Next.js 15, TypeScript, Tailwind CSS v4, Recharts
- **Mobile**: React Native, Expo 54
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Forms**: React Hook Form + Zod
- **Export**: jsPDF + xlsx
