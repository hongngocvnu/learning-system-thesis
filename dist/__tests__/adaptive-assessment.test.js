sẽimport;
{
    AdaptiveAssessmentSystem;
}
from;
'../adaptive-assessment';
// Mock Supabase client
const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    then: jest.fn(),
    catch: jest.fn(),
};
describe('AdaptiveAssessmentSystem', () => {
    let assessment;
    beforeAll(async () => {
        // Initialize with mock data
        assessment = await AdaptiveAssessmentSystem.initializeFromDatabase(1, // courseId
        1, // chapterId
        1, // userId
        mockSupabase, {
            masteryThreshold: 0.7,
            confidenceThreshold: 0.05,
            preSampleCount: 2,
            maxQuestions: 10,
            sampling_policy: 'HDoC',
        });
    });
    test('should initialize and start assessment session', async () => {
        mockSupabase.insert.mockResolvedValue({ error: null });
        mockSupabase.select.mockResolvedValue({ data: [{ id: 123 }], error: null });
        mockSupabase.from.mockReturnValue(mockSupabase);
        const session = await assessment.startAssessment();
        expect(session).toBeDefined();
        expect(session.id).toBe(123);
    });
    test('should get next question during pre-sample phase', async () => {
        assessment['currentSession'] = {
            id: 123,
            student_id: 1,
            course_id: 1,
            chapter_id: 1,
            start_time: new Date(),
            end_time: null,
            status: 'in_progress',
            sampling_policy: 'HDoC',
            max_questions: 10,
            pre_sample_count: 2,
            pre_sample_completed: false,
            pre_sample_progress: assessment['topics'].map(topic => ({ lo_id: topic.id, questions_asked: 0 })),
            questions_asked: 0,
        };
        const question = await assessment.getNextQuestion();
        expect(question).toBeDefined();
        expect(question?.hasBeenAsked).toBe(true);
    });
    test('should transition to adaptive phase after pre-sample', async () => {
        // Mark pre-sample as completed
        assessment['currentSession'].pre_sample_completed = true;
        assessment['currentSession'].pre_sample_progress.forEach(p => (p.questions_asked = 2));
        const question = await assessment.getNextQuestion();
        expect(question).toBeDefined();
        expect(question?.hasBeenAsked).toBe(true);
    });
    test('should process answer and update mastery', async () => {
        const question = assessment['questions'][0];
        assessment['currentSession'] = {
            id: 123,
            student_id: 1,
            course_id: 1,
            chapter_id: 1,
            start_time: new Date(),
            end_time: null,
            status: 'in_progress',
            sampling_policy: 'HDoC',
            max_questions: 10,
            pre_sample_count: 2,
            pre_sample_completed: true,
            pre_sample_progress: assessment['topics'].map(topic => ({ lo_id: topic.id, questions_asked: 2 })),
            questions_asked: 1,
        };
        mockSupabase.insert.mockResolvedValue({ error: null });
        mockSupabase.from.mockReturnValue(mockSupabase);
        mockSupabase.update.mockResolvedValue({ error: null });
        await assessment.processAnswer(question.id, true);
        const state = assessment.studentState.topicMastery.get(question.topic_id);
        expect(state).toBeDefined();
        expect(state?.alpha).toBeGreaterThan(1);
    });
    test('should end assessment when max questions reached', async () => {
        assessment['currentSession'].questions_asked = 10;
        const result = await assessment.getNextQuestion();
        expect(result).toBeNull();
    });
});
export {};
