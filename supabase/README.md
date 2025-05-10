# Learning System Database Setup

This directory contains the database schema and configuration for the Learning System project using Supabase.

## Prerequisites

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

## Setup Instructions

1. Initialize Supabase in your project:
```bash
supabase init
```

2. Start the local Supabase instance:
```bash
supabase start
```

3. Apply the database migrations:
```bash
supabase db push
```

4. To link your local project to a remote Supabase project:
```bash
supabase link --project-ref your-project-ref
```

5. To push your local changes to the remote project:
```bash
supabase db push
```

## Database Schema

The database includes the following main tables:

- `users`: Stores user information
- `courses`: Course information
- `chapters`: Course chapters
- `learning_objectives`: Learning objectives for each chapter
- `questions`: Assessment questions
- `choices`: Multiple choice options for questions
- `question_lo`: Mapping between questions and learning objectives
- `learning_materials`: Learning resources
- `student_lo_mastery`: Tracks student mastery of learning objectives
- `assessment_sessions`: Test sessions
- `assessment_results`: Test results
- `learning_paths`: Personalized learning paths
- `lo_dependencies`: Dependencies between learning objectives
- `enrollments`: Student course enrollments

## Development Workflow

1. Make changes to the schema in `migrations/20240320000000_initial_schema.sql`
2. Test changes locally using `supabase start`
3. Push changes to remote using `supabase db push`

## Useful Commands

- View local database: `supabase db reset`
- Stop local instance: `supabase stop`
- View logs: `supabase logs`
- Generate types: `supabase gen types typescript --local > types/supabase.ts`

## Security

- All tables have appropriate indexes for performance
- Foreign key constraints ensure data integrity
- Timestamps are automatically managed
- UUIDs are used for all primary keys

## Backup and Restore

To backup your database:
```bash
supabase db dump -f backup.sql
```

To restore from backup:
```bash
supabase db reset
psql -f backup.sql
``` 