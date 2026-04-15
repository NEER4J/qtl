# SaaS Starter Template

A modern SaaS starter template built with Next.js (App Router), Supabase Auth, Tailwind CSS, and shadcn/ui.

## Features

- **Authentication**: Complete auth system with email/password and Google OAuth
- **Dashboard**: Modern sidebar navigation with collapsible menu
- **UI Components**: Comprehensive shadcn/ui component library
- **Theme Support**: Dark mode with system preference detection
- **Responsive Design**: Mobile-first design with adaptive layouts

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Authentication**: Supabase Auth
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React
- **Notifications**: Sonner

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

Create a `.env.local` file with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
saas-starter/
├── app/
│   ├── auth/          # Authentication pages
│   ├── dashboard/     # Dashboard pages
│   └── layout.tsx     # Root layout
├── components/
│   ├── auth/          # Auth form components
│   ├── sidebar/       # Sidebar navigation components
│   └── ui/            # Reusable UI components
├── config/            # App configuration
├── lib/               # Utility functions and helpers
├── hooks/             # Custom React hooks
└── navigation/        # Navigation configuration
```

## Authentication

The app includes a complete authentication system:

- Login/Register pages
- Password reset flow
- Email verification
- Google OAuth integration
- Protected routes

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

Use as a starter template for your own SaaS.
