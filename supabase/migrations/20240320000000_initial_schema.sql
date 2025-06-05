-- Users table
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'lecturer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE courses (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    lecturer_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chapters table
CREATE TABLE chapters (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title VARCHAR(255) NOT NULL,
    order_num INTEGER NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Learning Objectives table
CREATE TABLE learning_objectives (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    lo_code VARCHAR(50) NOT NULL,
    mastery_threshold FLOAT DEFAULT 0.6,
    confidence_delta FLOAT DEFAULT 0.05,
    min_samples INTEGER DEFAULT 5,
    difficulty FLOAT DEFAULT 1.0,
    concept_weight FLOAT DEFAULT 1.0,
    time_decay_factor FLOAT DEFAULT 0.1,
    dependencies JSONB DEFAULT '{}',
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Questions table
CREATE TABLE questions (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question_rich_text TEXT NOT NULL,
    explanation TEXT,
    difficulty FLOAT DEFAULT 1.0,
    concept_weight FLOAT DEFAULT 1.0,
    time_decay_factor FLOAT DEFAULT 0.1,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Choices table
CREATE TABLE choices (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    choice TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Question-LO mappings
CREATE TABLE question_lo (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    lo_id INTEGER NOT NULL REFERENCES learning_objectives(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(question_id, lo_id)
);

-- Learning Materials table
CREATE TABLE learning_materials (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lo_id INTEGER NOT NULL REFERENCES learning_objectives(id),
    type VARCHAR(50) NOT NULL,
    url TEXT NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Student LO Mastery table
CREATE TABLE student_lo_mastery (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    lo_id INTEGER NOT NULL REFERENCES learning_objectives(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    alpha FLOAT DEFAULT 1.0,
    beta FLOAT DEFAULT 1.0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    performance_history JSONB DEFAULT '[]',
    UNIQUE(student_id, lo_id, course_id)
);

-- Enable Row Level Security
ALTER TABLE student_lo_mastery ENABLE ROW LEVEL SECURITY;

-- Create policy to allow students to read their own mastery data
CREATE POLICY "Students can read their own mastery data"
ON student_lo_mastery
FOR SELECT
TO authenticated
USING (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

-- Create policy to allow students to insert their own mastery data
CREATE POLICY "Students can insert their own mastery data"
ON student_lo_mastery
FOR INSERT
TO authenticated
WITH CHECK (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

-- Create policy to allow students to update their own mastery data
CREATE POLICY "Students can update their own mastery data"
ON student_lo_mastery
FOR UPDATE
TO authenticated
USING (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
)
WITH CHECK (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

-- Add index for course_id
CREATE INDEX idx_student_lo_mastery_course_id ON student_lo_mastery(course_id);

-- Assessment Sessions table
CREATE TYPE assessment_status AS ENUM ('in_progress', 'completed', 'abandoned');
CREATE TYPE sampling_policy AS ENUM ('Thompson', 'HDoC', 'Random');

CREATE TABLE assessment_sessions (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    chapter_id INTEGER NOT NULL REFERENCES chapters(id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    status assessment_status DEFAULT 'in_progress',
    sampling_policy sampling_policy DEFAULT 'Thompson',
    max_questions INTEGER DEFAULT 30,
    pre_sample_count INTEGER DEFAULT 5,
    pre_sample_completed BOOLEAN DEFAULT FALSE,
    pre_sample_progress JSONB DEFAULT '[]',
    questions_asked INTEGER DEFAULT 0,
    UNIQUE(student_id, course_id, chapter_id, status)
);

-- Enable RLS for assessment_sessions
ALTER TABLE assessment_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow students to read their own assessment sessions
CREATE POLICY "Students can read their own assessment sessions"
ON assessment_sessions
FOR SELECT
TO authenticated
USING (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

-- Create policy to allow students to insert their own assessment sessions
CREATE POLICY "Students can insert their own assessment sessions"
ON assessment_sessions
FOR INSERT
TO authenticated
WITH CHECK (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

-- Create policy to allow students to update their own assessment sessions
CREATE POLICY "Students can update their own assessment sessions"
ON assessment_sessions
FOR UPDATE
TO authenticated
USING (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
)
WITH CHECK (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

-- Add index for course_id
CREATE INDEX idx_assessment_sessions_course_id ON assessment_sessions(course_id);

-- Add index for chapter_id
CREATE INDEX idx_assessment_sessions_chapter_id ON assessment_sessions(chapter_id);

-- Assessment Results table
CREATE TABLE assessment_results (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES assessment_sessions(id),
    question_id INTEGER NOT NULL REFERENCES questions(id),
    student_id INTEGER NOT NULL REFERENCES users(id),
    is_correct BOOLEAN NOT NULL,
    difficulty_level FLOAT DEFAULT 1.0,
    pseudo_rewards JSONB DEFAULT '{}',
    confidence_bounds JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Learning Paths table
CREATE TYPE learning_path_status AS ENUM ('active', 'completed', 'abandoned');

CREATE TABLE learning_paths (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    weak_lo_id INTEGER NOT NULL REFERENCES learning_objectives(id),
    path_sequence JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status learning_path_status DEFAULT 'active'
);


CREATE TABLE lo_dependencies (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lo_id INTEGER NOT NULL REFERENCES learning_objectives(id),
    dependent_lo_id INTEGER NOT NULL REFERENCES learning_objectives(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lo_id, dependent_lo_id)
);

-- Indexes
CREATE INDEX idx_courses_lecturer_id ON courses(lecturer_id);
CREATE INDEX idx_chapters_course_id ON chapters(course_id);
CREATE INDEX idx_learning_objectives_chapter_id ON learning_objectives(chapter_id);
CREATE INDEX idx_choices_question_id ON choices(question_id);
CREATE INDEX idx_question_lo_question_id ON question_lo(question_id);
CREATE INDEX idx_question_lo_lo_id ON question_lo(lo_id);
CREATE INDEX idx_learning_materials_lo_id ON learning_materials(lo_id);
CREATE INDEX idx_student_lo_mastery_student_id ON student_lo_mastery(student_id);
CREATE INDEX idx_student_lo_mastery_lo_id ON student_lo_mastery(lo_id);
CREATE INDEX idx_assessment_sessions_student_id ON assessment_sessions(student_id);
CREATE INDEX idx_assessment_results_assessment_id ON assessment_results(assessment_id);
CREATE INDEX idx_assessment_results_student_id ON assessment_results(student_id);
CREATE INDEX idx_learning_paths_student_id ON learning_paths(student_id);
CREATE INDEX idx_learning_paths_course_id ON learning_paths(course_id);
CREATE INDEX idx_learning_paths_weak_lo_id ON learning_paths(weak_lo_id);
CREATE INDEX idx_lo_dependencies_lo_id ON lo_dependencies(lo_id);
CREATE INDEX idx_lo_dependencies_dependent_lo_id ON lo_dependencies(dependent_lo_id);

-- Triggers
CREATE OR REPLACE FUNCTION update_student_lo_mastery_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_student_lo_mastery_timestamp
    BEFORE UPDATE ON student_lo_mastery
    FOR EACH ROW
    EXECUTE FUNCTION update_student_lo_mastery_timestamp();

-- Constraints
ALTER TABLE lo_dependencies
ADD CONSTRAINT different_lo_ids CHECK (lo_id != dependent_lo_id);

-- Enrollments table
CREATE TABLE enrollments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    student_id INTEGER NOT NULL REFERENCES users(id),
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, student_id)
);

CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);