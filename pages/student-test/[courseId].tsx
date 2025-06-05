import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/router';
import Header from '../../components/Header';
import Link from 'next/link'; // Keep Link for navigation
import { AdaptiveAssessmentSystem, AdaptiveAssessmentSystemType, Question as AdaptiveQuestion, AssessmentConfig, WeakKC as AdaptiveWeakKC, AssessmentResult as AdaptiveAssessmentResult, AssessmentEndResult as BackendAssessmentEndResult, TopicMasteryState as BackendTopicMasteryState, WeakKC as BackendWeakKC } from '../../lib/adaptive-assessment'; // Import types from backend
import ChapterList from '../../components/ChapterList';
import { Button } from '@mui/material';
import { toast } from 'react-hot-toast';

// --- UI Specific Interfaces --- (Can potentially reuse backend types now)
interface TopicForUI {
    id: number;
    name: string;
    lcb: number; // Percentage 0-100
    ucb: number; // Percentage 0-100
    questionsAsked: number;
    successRate: number; // Percentage 0-100
    confidence: number; // Percentage 0-100, higher is better
    mastery: number; // Percentage 0-100
    prerequisites: number[];
    level: number;
    failedQuestions: number;
}

interface AssessmentSession {
    id: number;
    student_id: number;
    course_id: number;
    start_time: string;
    end_time: string | null;
    status: 'in_progress' | 'completed' | 'abandoned';
    sampling_policy: 'Thompson' | 'HDoC' | 'Random';
    max_questions: number;
    pre_sample_count: number;
}

interface AssessmentResultForUI {
    totalQuestions: number;
    recommendedTopics: TopicForUI[];
}

// Use backend WeakKC type directly
type WeakKCForUI = BackendWeakKC;

// Use backend AssessmentEndResult type directly
type AssessmentEndResultForUI = BackendAssessmentEndResult;

// Use backend TopicMasteryState type directly
type TopicMasteryStateForUI = BackendTopicMasteryState;

// Add simple type for final result UI
interface SimpleTopicForUI {
  id: string | number;
  name: string;
}
interface SimpleAssessmentResultForUI {
  totalQuestions: number;
  recommendedTopics: SimpleTopicForUI[];
}

// --- Main StudentTest Component ---
export default function StudentTest() {
    const router = useRouter();
    const { courseId, chapterId } = router.query;
    const [assessment, setAssessment] = useState<AdaptiveAssessmentSystem | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<AdaptiveQuestion | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [assessmentSessionId, setAssessmentSessionId] = useState<number | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [assessmentComplete, setAssessmentComplete] = useState(false);
    const [assessmentResults, setAssessmentResults] = useState<SimpleAssessmentResultForUI | null>(null);
    const [questionCount, setQuestionCount] = useState(0);
    const [userData, setUserData] = useState<{ id: number } | null>(null);
    const [weakKC, setWeakKC] = useState<WeakKCForUI | null>(null);
    const [chapters, setChapters] = useState<any[]>([]);
    const initializationRef = useRef(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [personalizedFeedback, setPersonalizedFeedback] = useState<string | null>(null);
    const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
    const [feedbacks, setFeedbacks] = useState<{ [loId: string]: string }>({});
    const [loadingFeedbacks, setLoadingFeedbacks] = useState<{ [loId: string]: boolean }>({});

    const defaultAssessmentConfig = {
        masteryThreshold: 0.7, // ξ: Threshold for considering a topic mastered/strong
        confidenceThreshold: 0.05, // δ: Error rate for statistical confidence
        preSampleCount: 1, // π: Number of initial questions to ask for each LO in the pre-sample phase
        maxQuestions: 50, // Budget: Maximum total questions per session
        sampling_policy: 'HDoC' as const // MAB algorithm to use (HDoC, Thompson Sampling, Random)
    };

    // Load chapters for the course
    const loadChapters = useCallback(async () => {
        if (!courseId || typeof courseId !== 'string') return;
        try {
            const { data: chaptersData, error: chaptersError } = await supabase
                .from('chapters')
                .select('*')
                .eq('course_id', courseId)
                .order('id', { ascending: true });

            if (chaptersError) throw chaptersError;
            setChapters(chaptersData || []);
        } catch (err: any) {
            console.error('Error loading chapters:', err);
            setError(err.message || 'Failed to load chapters');
        } finally {
            setIsLoading(false);
        }
    }, [courseId]);

    // Callback to handle assessment completion logic
    // Accept endResult data directly (now using BackendAssessmentEndResult type)
    const handleAssessmentComplete = async () => {
        // Không làm gì cả, mọi thứ đã được cập nhật trong handleAnswer
        return;
    };

    // Initialize assessment system
    const initializeAndStartAssessment = useCallback(async () => {
        if (!courseId || !chapterId || typeof courseId !== 'string' || typeof chapterId !== 'string' || assessment || initializationRef.current) {
            return;
        }

        try {
            initializationRef.current = true;
            setIsLoading(true);
            setError(null);

            // 1. Get current user ID from Supabase Auth
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user) throw new Error('User not authenticated.');

            // Get user_id from your custom 'users' table
            const { data: userDataFromDb, error: userDataError } = await supabase
                .from('users')
                .select('id')
                .eq('email', user.email)
                .maybeSingle();

            if (userDataError) {
                console.error('Error fetching user data:', userDataError);
                throw new Error('Failed to fetch user data. Please try again.');
            }

            if (!userDataFromDb) {
                console.error('User not found in database:', user.email);
                throw new Error('User account not found. Please contact your administrator.');
            }

            setUserData(userDataFromDb);

            const courseIdNum = parseInt(courseId);
            const chapterIdNum = parseInt(chapterId);
            if (isNaN(courseIdNum) || isNaN(chapterIdNum)) {
                throw new Error('Invalid course or chapter ID provided.');
            }

            // 2. Initialize AdaptiveAssessmentSystem
            console.log('Starting AdaptiveAssessmentSystem initialization...');
            const newAssessmentSystem = await AdaptiveAssessmentSystem.initializeFromDatabase(
                courseIdNum,
                chapterIdNum,
                userDataFromDb.id,
                supabase,
                defaultAssessmentConfig
            );

            if (!newAssessmentSystem) {
                throw new Error('Failed to initialize assessment system.');
            }

            console.log('AdaptiveAssessmentSystem initialized successfully');

            // 3. Start new session
            console.log('Starting new assessment session...');
            await newAssessmentSystem.startAssessment();
            
            if (!newAssessmentSystem.isSessionActive()) {
                throw new Error('Failed to start assessment session.');
            }

            console.log('Assessment session started successfully');

            // 4. Load student history
            console.log('Loading student history...');
            await newAssessmentSystem.loadStudentHistory();
            console.log('Student history loaded successfully');

            // 5. Get first question
            const firstQuestion = await newAssessmentSystem.getNextQuestion();
            if (!firstQuestion) {
                throw new Error('No questions available for this chapter.');
            }

            // Set state only after everything is successful
            setAssessment(newAssessmentSystem);
            setCurrentQuestion(firstQuestion);
            setQuestionCount(1);

        } catch (err: any) {
            console.error('Error during assessment initialization:', err);
            setError(err.message || 'An unexpected error occurred during assessment setup.');
            initializationRef.current = false;
        } finally {
            setIsLoading(false);
        }
    }, [courseId, chapterId]);

    // Effect hook to load chapters when courseId is available
    useEffect(() => {
        if (router.isReady) {
            loadChapters();
        }
    }, [router.isReady, loadChapters]);

    // Effect hook to initialize assessment when both courseId and chapterId are available
    useEffect(() => {
        if (router.isReady && courseId && chapterId) {
            initializeAndStartAssessment();
        }
    }, [router.isReady, courseId, chapterId, initializeAndStartAssessment]);

    // Handler for submitting an answer
    const handleAnswer = async () => {
        if (!currentQuestion || selectedAnswer === null || !assessment || !userData || assessmentComplete || isSubmitting) {
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);

            // Verify session is active
            if (!assessment.isSessionActive()) {
                throw new Error('Assessment session is not active. Please refresh the page and try again.');
            }

            const isCorrect = selectedAnswer === currentQuestion.correctOption;
            const processResult = await assessment.processAnswer(currentQuestion.id, isCorrect);
            setQuestionCount(prev => prev + 1);

            // Nếu processResult trả về (session kết thúc), chỉ dùng object này để cập nhật UI
            if (processResult) {
                // Map kết quả trả về cho UI
                let recommendedTopicsForUI: SimpleTopicForUI[] = [];
                if (processResult.weakKC) {
                    recommendedTopicsForUI.push({
                        id: ('lo_code' in processResult.weakKC ? (processResult.weakKC as any).lo_code : processResult.weakKC.topicId) as string | number,
                        name: processResult.weakKC.name
                    });
                } else {
                    recommendedTopicsForUI.push({
                        id: 0,
                        name: 'No Weak Learning Objective'
                    });
                }
                setAssessmentResults({
                    totalQuestions: processResult.questionsAsked,
                    recommendedTopics: recommendedTopicsForUI
                });
                setShowResults(true);
                setCurrentQuestion(null);
                setAssessmentComplete(true);
                setWeakKC(null);
                setSelectedAnswer(null);
                setTimeout(() => setShowConfetti(false), 5000);
                return;
            }

            // Nếu chưa kết thúc, lấy câu hỏi tiếp theo
            const nextQuestion = await assessment.getNextQuestion();
            if (nextQuestion) {
                setCurrentQuestion(nextQuestion);
                setSelectedAnswer(null);
                setWeakKC(null);
            } else {
                // Nếu không còn câu hỏi, kết thúc session (safeguard, nhưng endAssessment đã được gọi ở backend)
                setAssessmentComplete(true);
                setCurrentQuestion(null);
                setWeakKC(null);
                setShowResults(true);
            }
        } catch (err: any) {
            console.error('Error processing answer:', err);
            setError(err.message || 'Failed to process answer. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchPersonalizedFeedback = useCallback(async (weakKC: WeakKCForUI) => {
        setIsLoadingFeedback(true);
        setPersonalizedFeedback(null);
        try {
            const res = await fetch('/api/gemini-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    weakLOName: weakKC.name,
                    prerequisiteLOs: weakKC.prerequisites, // cần lấy tên, không chỉ id
                    subjectName: 'Tên môn học', // TODO: truyền đúng tên môn học
                    alpha: weakKC.alpha,
                    beta: weakKC.beta,
                    questionsAsked: weakKC.questionsAsked,
                    masteryThreshold: defaultAssessmentConfig.masteryThreshold * 100,
                }),
            });
            const data = await res.json();
            setPersonalizedFeedback(data.markdown);
        } catch (err) {
            setPersonalizedFeedback('Failed to load personalized feedback.');
        } finally {
            setIsLoadingFeedback(false);
        }
    }, [defaultAssessmentConfig.masteryThreshold]);

    useEffect(() => {
        if (weakKC) {
            fetchPersonalizedFeedback(weakKC);
        }
    }, [weakKC, fetchPersonalizedFeedback]);

    const fetchFeedbackForLO = useCallback(async (lo: SimpleTopicForUI) => {
        setLoadingFeedbacks(prev => ({ ...prev, [lo.id]: true }));
        try {
            // 1. Fetch prerequisite LOs (LOs that this LO depends on)
            const { data: prerequisitesData } = await supabase
                .from('lo_dependencies')
                .select('lo_id, graph, learning_objectives:title(lo_id, title)')
                .eq('dependent_lo_id', lo.id);
            const prerequisites = (prerequisitesData || []).map((d: any) => `${d.learning_objectives?.title || d.lo_id} (${d.graph})`);
            const prerequisitesStr = prerequisites.length > 0 ? prerequisites.join(', ') : 'None';

            // 2. Fetch dependent LOs (LOs that depend on this LO)
            const { data: dependentsData } = await supabase
                .from('lo_dependencies')
                .select('dependent_lo_id, graph, learning_objectives!dependent_lo_id(title)')
                .eq('lo_id', lo.id);
            const dependents = (dependentsData || []).map((d: any) => `${d.learning_objectives?.title || d.dependent_lo_id} (${d.graph})`);
            const dependentsStr = dependents.length > 0 ? dependents.join(', ') : 'None';

            // 3. Call Gemini feedback API with English prompt
            const res = await fetch('/api/gemini-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    weakLOName: lo.name,
                    prerequisiteLOsFormatted: prerequisitesStr,
                    dependentLOsFormatted: dependentsStr,
                    subjectName: 'Course Name', // TODO: pass real course name
                    alpha: 1, // TODO: pass real alpha
                    beta: 1, // TODO: pass real beta
                    questionsAsked: 1, // TODO: pass real questions asked
                    masteryThreshold: defaultAssessmentConfig.masteryThreshold * 100,
                }),
            });
            const data = await res.json();
            setFeedbacks(prev => ({ ...prev, [lo.id]: data.feedback }));
        } catch {
            setFeedbacks(prev => ({ ...prev, [lo.id]: 'Failed to load feedback.' }));
        } finally {
            setLoadingFeedbacks(prev => ({ ...prev, [lo.id]: false }));
        }
    }, [defaultAssessmentConfig.masteryThreshold]);

    useEffect(() => {
        if (assessmentResults?.recommendedTopics) {
            assessmentResults.recommendedTopics.forEach(lo => {
                if (!feedbacks[lo.id]) fetchFeedbackForLO(lo);
            });
        }
        // eslint-disable-next-line
    }, [assessmentResults, fetchFeedbackForLO]);

    // --- UI Rendering Logic ---
    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f2a4e]"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
                    <div className="text-6xl mb-4">📚</div>
                    <h2 className="text-2xl font-bold text-[#0f2a4e] mb-4">No Questions Available</h2>
                    <p className="text-gray-600 mb-6">
                        {error === 'No questions mapped to learning objectives in this chapter' 
                            ? 'This chapter does not have any questions mapped to learning objectives yet. Please check back later or contact your instructor.'
                            : error}
                    </p>
                    <Link href={`/course/${courseId}/chapters`}>
                        <button className="bg-[#0f2a4e] text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition-colors">
                            Return to Chapters
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    // If no chapter is selected, show chapter selection UI
    if (!chapterId) {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f2a4e]"></div>
                </div>
            );
        }
        return (
            <div className="min-h-screen bg-gray-50">
                <Header />
                <div className="container mx-auto px-4 py-8">
                    <div className="mb-6">
                        <Link 
                            href={`/student-course/${courseId}`} 
                            className="text-[#0f2a4e] hover:text-blue-800 flex items-center"
                        >
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                className="h-5 w-5 mr-2" 
                                viewBox="0 0 20 20" 
                                fill="currentColor"
                            >
                                <path 
                                    fillRule="evenodd" 
                                    d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" 
                                    clipRule="evenodd" 
                                />
                            </svg>
                            Back to Course Overview
                        </Link>
                    </div>
                    <h2 className="text-2xl font-bold text-[#0f2a4e] mb-6">Select a Chapter to Start the Test</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {chapters.map((chapter: any) => (
                            <Link
                                key={chapter.id}
                                href={`/student-test/${courseId}?chapterId=${chapter.id}`}
                                className="block"
                            >
                                <div className="bg-white rounded-lg shadow-lg p-8 flex items-center justify-center h-40 transition cursor-pointer border border-gray-200 hover:bg-[#0f2a4e] hover:text-white hover:border-[#0f2a4e] text-[#0f2a4e] text-lg font-semibold text-center duration-200" style={{ minHeight: '160px' }}>
                                    {chapter.title}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <div className="container mx-auto px-4 py-8">
                {showResults && assessmentResults ? (
                    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-2xl font-bold text-[#0f2a4e] mb-6">Assessment Result</h2>
                        <div className="mb-6">
                            <p className="text-lg">Total questions answered: {assessmentResults.totalQuestions}</p>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-[#0f2a4e]">Areas to Improve:</h3>
                            {assessmentResults.recommendedTopics.map((topic) => (
                                <div key={topic.id} className="border rounded-lg p-4">
                                    <h4 className="font-semibold text-lg mb-2">
                                        {topic.name === 'No Weak Learning Objective' ? 'No Weak Learning Objective' : `${topic.name} (${topic.id})`}
                                    </h4>
                                    {topic.name !== 'No Weak Learning Objective' && (
                                        <div className="grid grid-cols-1 gap-2">
                                            <p>LO Code: <span className="font-semibold">{topic.id}</span></p>
                                            <p>LO Name: <span className="font-semibold">{topic.name}</span></p>
                                        </div>
                                    )}
                                    {/* Personalized Feedback Section for summary result */}
                                    {topic.name !== 'No Weak Learning Objective' && (
                                        loadingFeedbacks[topic.id] ? (
                                            <div className="mt-4 text-blue-600">Đang tạo lộ trình cá nhân hóa...</div>
                                        ) : feedbacks[topic.id] ? (
                                            <FeedbackComponent feedback={feedbacks[topic.id]} />
                                        ) : null
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 text-center">
                            <Link href={`/dashboard-student`}>
                                <Button variant="contained" color="primary">
                                    Back to Dashboard
                                </Button>
                            </Link>
                        </div>
                    </div>
                ) : weakKC && assessment?.getCurrentPhase() === 'adaptive' ? (
                    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6 text-center">
                        <h2 className="text-2xl font-bold text-red-600 mb-4">Weak Learning Objective Detected!</h2>
                        <p className="text-lg mb-2">You have a weak area in:</p>
                        <div className="text-xl font-semibold text-[#0f2a4e] mb-2">{weakKC.name}</div>
                        <div className="grid grid-cols-2 gap-4 mt-6 text-left">
                            <div className="space-y-2">
                                <p className="text-gray-600">Mastery: <span className="font-semibold">{weakKC.mastery.toFixed(1)}%</span></p>
                                <p className="text-gray-600">Confidence: <span className="font-semibold">{weakKC.confidence.toFixed(1)}%</span></p>
                                <p className="text-gray-600">Questions Answered (this LO): <span className="font-semibold">{weakKC.questionsAsked}</span></p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-gray-600">Success Rate (this LO): <span className="font-semibold">{weakKC.successRate.toFixed(1)}%</span></p>
                                <p className="text-gray-600">Correct Answers (this LO): <span className="font-semibold">{weakKC.alpha}</span></p>
                                <p className="text-gray-600">Incorrect Answers (this LO): <span className="font-semibold">{weakKC.beta}</span></p>
                            </div>
                        </div>
                        {/* Personalized Feedback Section */}
                        {isLoadingFeedback ? (
                            <div className="mt-6 text-blue-600">Creating personalized feedback...</div>
                        ) : personalizedFeedback ? (
                            <FeedbackComponent feedback={personalizedFeedback} />
                        ) : null}
                        <div className="mt-8">
                            <button
                                onClick={() => handleAssessmentComplete()}
                                className="bg-[#0f2a4e] text-white px-6 py-2 rounded hover:bg-blue-800"
                            >
                                Complete Assessment
                            </button>
                        </div>
                    </div>
                ) : currentQuestion && !assessmentComplete ? (
                    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
                        <div className="mb-6">
                            <h2 className="text-xl font-semibold text-[#0f2a4e] mb-2">
                                Question {questionCount} of {assessment?.getQuestionLimits().total.max}
                            </h2>
                            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: currentQuestion.question_rich_text }} />
                        </div>

                        <div className="space-y-4 mb-6">
                            {currentQuestion.choices.map((choice, index) => (
                                <label
                                    key={choice.id}
                                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                                        selectedAnswer === index
                                            ? 'border-[#0f2a4e] bg-blue-50'
                                            : 'border-gray-200 hover:border-[#0f2a4e]'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="answer"
                                        value={index}
                                        checked={selectedAnswer === index}
                                        onChange={() => setSelectedAnswer(index)}
                                        className="mr-3"
                                    />
                                    <span className="text-gray-700">{choice.choice}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={handleAnswer}
                                disabled={isSubmitting || selectedAnswer === null}
                                className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? 'Processing...' : 'Submit'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        {assessmentComplete ? (
                            // When assessment is complete and results are handled, show a completion message
                             showResults && assessmentResults ? null : (
                                 <div className="text-green-600 font-semibold text-xl mb-4">Assessment Complete!</div>
                             )

                        ) : (
                             // When not complete and no question, show loading/initial message
                             <>
                                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Loading Assessment...</h2>
                                <p className="text-gray-600">Please wait while we prepare your questions.</p>
                             </>
                        )}
                         {/* Optionally show a button to go back if something went wrong and not complete */}
                         {!assessmentComplete && !isLoading && !currentQuestion && error && (
                             <div className="mt-6">
                                  <Link href={`/course/${courseId}/chapters`}>
                                    <Button variant="contained" color="secondary">
                                        Return to Chapters
                                    </Button>
                                  </Link>
                             </div>
                         )}
                          {/* If assessmentComplete is true but showResults is false (e.g., error after completion) */}
                         {assessmentComplete && !showResults && !error && (
                             <div className="mt-6">
                                 <p className="text-red-500 mb-4">There was an issue displaying results.</p>
                                  <Link href={`/course/${courseId}/chapters`}>
                                    <Button variant="contained" color="secondary">
                                        Return to Chapters
                                    </Button>
                                  </Link>
                             </div>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper function to match Python's max (if not using Math.max)
// function max(a: number, b: number): number {
//     return a > b ? a : b;
// }

// Ensure jStat is available globally or imported correctly if needed for frontend calculations
// import jstat from 'jstat'; // Example import if jstat is a separate package

function FeedbackComponent({ feedback }: { feedback: string }) {
  return (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      {feedback}
    </div>
  );
}