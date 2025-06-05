-- Create policies for users table
CREATE POLICY "Users can read their own data"
ON users FOR SELECT
TO authenticated
USING (email = auth.jwt()->>'email');

-- Create policies for courses table
CREATE POLICY "Anyone can read courses"
ON courses FOR SELECT
TO authenticated
USING (true);

-- Create policies for chapters table
CREATE POLICY "Anyone can read chapters"
ON chapters FOR SELECT
TO authenticated
USING (true);

-- Create policies for learning_objectives table
CREATE POLICY "Anyone can read learning objectives"
ON learning_objectives FOR SELECT
TO authenticated
USING (true);

-- Create policies for questions table
CREATE POLICY "Anyone can read questions"
ON questions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Lecturers can insert questions"
ON questions FOR INSERT
TO authenticated
WITH CHECK (
    created_by IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
        AND role = 'lecturer'
    )
);

CREATE POLICY "Lecturers can update their own questions"
ON questions FOR UPDATE
TO authenticated
USING (
    created_by IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
        AND role = 'lecturer'
    )
)
WITH CHECK (
    created_by IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
        AND role = 'lecturer'
    )
);

CREATE POLICY "Lecturers can delete their own questions"
ON questions FOR DELETE
TO authenticated
USING (
    created_by IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
        AND role = 'lecturer'
    )
);

-- Create policies for choices table
CREATE POLICY "Anyone can read choices"
ON choices FOR SELECT
TO authenticated
USING (true);

-- Create policies for question_lo table
CREATE POLICY "Anyone can read question_lo mappings"
ON question_lo FOR SELECT
TO authenticated
USING (true);

-- Create policies for learning_materials table
CREATE POLICY "Anyone can read learning materials"
ON learning_materials FOR SELECT
TO authenticated
USING (true);

-- Create policies for student_lo_mastery table
CREATE POLICY "Students can read their own mastery data"
ON student_lo_mastery FOR SELECT
TO authenticated
USING (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Students can insert their own mastery data"
ON student_lo_mastery FOR INSERT
TO authenticated
WITH CHECK (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Students can update their own mastery data"
ON student_lo_mastery FOR UPDATE
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

-- Create policies for assessment_sessions table
CREATE POLICY "Students can read their own assessment sessions"
ON assessment_sessions FOR SELECT
TO authenticated
USING (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Students can insert their own assessment sessions"
ON assessment_sessions FOR INSERT
TO authenticated
WITH CHECK (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Students can update their own assessment sessions"
ON assessment_sessions FOR UPDATE
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

-- Create policies for assessment_results table
CREATE POLICY "Students can read their own assessment results"
ON assessment_results FOR SELECT
TO authenticated
USING (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Students can insert their own assessment results"
ON assessment_results FOR INSERT
TO authenticated
WITH CHECK (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Students can update their own assessment results"
ON assessment_results FOR UPDATE
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

-- Create policies for learning_paths table
CREATE POLICY "Students can read their own learning paths"
ON learning_paths FOR SELECT
TO authenticated
USING (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Students can insert their own learning paths"
ON learning_paths FOR INSERT
TO authenticated
WITH CHECK (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Students can update their own learning paths"
ON learning_paths FOR UPDATE
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

-- Create policies for lo_dependencies table
CREATE POLICY "Anyone can read lo_dependencies"
ON lo_dependencies FOR SELECT
TO authenticated
USING (true);

-- Create policies for enrollments table
CREATE POLICY "Students can read their own enrollments"
ON enrollments FOR SELECT
TO authenticated
USING (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Students can insert their own enrollments"
ON enrollments FOR INSERT
TO authenticated
WITH CHECK (
    student_id IN (
        SELECT id FROM users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Students can update their own enrollments"
ON enrollments FOR UPDATE
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