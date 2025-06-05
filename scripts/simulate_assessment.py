import numpy as np
from scipy import stats
import json
from typing import List, Dict, Set, Optional, Tuple
from dataclasses import dataclass
import os
from datetime import datetime

@dataclass
class Topic:
    id: int
    name: str
    description: str
    lo_code: str
    mastery_threshold: float
    confidence_delta: float
    min_samples: int
    difficulty: float
    concept_weight: float
    time_decay_factor: float
    questions: List['Question']
    has_been_asked: bool
    alpha: float
    beta: float
    level: int

@dataclass
class Question:
    id: int
    question_text: str
    explanation: str
    difficulty: float
    concept_weight: float
    time_decay_factor: float
    choices: List[Dict]
    correct_option: int
    topic_id: int

@dataclass
class StudentState:
    topic_estimates: Dict[int, float]
    topic_counts: Dict[int, int]
    total_questions: int
    answered_questions: Set[int]
    question_history: Dict[int, Set[int]]
    session_id: int
    topic_successes: Dict[int, int]
    topic_failures: Dict[int, int]
    topic_confidence: Dict[int, float]
    topic_mastery: Dict[int, Dict]

    def __init__(self):
        self.topic_estimates = {}
        self.topic_counts = {}
        self.total_questions = 0
        self.answered_questions = set()
        self.question_history = {}
        self.session_id = int(datetime.now().timestamp())
        self.topic_successes = {}
        self.topic_failures = {}
        self.topic_confidence = {}
        self.topic_mastery = {}

class SamplingPolicy:
    def select_topic(self, topics: List[Topic], student_state: StudentState) -> int:
        raise NotImplementedError

    def update_after_answer(self, topic_id: int, alpha: float, beta: float, mastery_threshold: float) -> Optional[str]:
        raise NotImplementedError

    def get_name(self) -> str:
        raise NotImplementedError

class HDoCPolicy(SamplingPolicy):
    def __init__(self, pre_sample_count: int, delta: float = 0.05, K: int = 10):
        self.A = set()
        self.pre_sample_count = pre_sample_count
        self.delta = delta
        self.K = K
        self.initialized = False

    def get_name(self) -> str:
        return 'HDoC'

    def initialize(self, topics: List[Topic]):
        self.A = {t.id for t in topics}
        self.initialized = True

    def select_topic(self, topics: List[Topic], student_state: StudentState) -> int:
        if not self.initialized:
            self.initialize(topics)

        # Pre-sample phase
        for topic in topics:
            if topic.id not in self.A:
                continue
            Nt = student_state.topic_counts.get(topic.id, 0)
            if Nt < self.pre_sample_count:
                return topic.id

        # Main phase: select i* in A with min HDoC score
        selected_topic_id = -1
        min_score = float('inf')
        t = student_state.total_questions + 1

        for topic in topics:
            if topic.id not in self.A:
                continue
            Nt = student_state.topic_counts.get(topic.id, 0)
            alpha = student_state.topic_successes.get(topic.id, 0)
            beta = student_state.topic_failures.get(topic.id, 0)
            mu = alpha / (alpha + beta) if (alpha + beta) > 0 else 0

            # HDoC score calculation
            score = mu + np.sqrt(
                np.log(4 * self.K * Nt**2 / self.delta) / 
                (2 * Nt**2)
            )

            if score < min_score:
                min_score = score
                selected_topic_id = topic.id

        return selected_topic_id

    def update_after_answer(self, topic_id: int, alpha: float, beta: float, mastery_threshold: float) -> Optional[str]:
        Nt = alpha + beta
        mu = alpha / Nt if Nt > 0 else 0

        # Calculate HDoC score
        score = mu + np.sqrt(
            np.log(4 * self.K * Nt**2 / self.delta) / 
            (2 * Nt**2)
        )

        if score >= mastery_threshold:
            self.A.discard(topic_id)
            return 'remove'
        elif score < mastery_threshold:
            return 'weak'
        return None

class ThompsonSamplingPolicy(SamplingPolicy):
    def __init__(self, pre_sample_count: int, delta: float = 0.05):
        self.A = set()
        self.pre_sample_count = pre_sample_count
        self.delta = delta
        self.initialized = False

    def get_name(self) -> str:
        return 'Thompson'

    def initialize(self, topics: List[Topic]):
        self.A = {t.id for t in topics}
        self.initialized = True

    def select_topic(self, topics: List[Topic], student_state: StudentState) -> int:
        if not self.initialized:
            self.initialize(topics)

        # Filter topics that are still in set A
        available_topics = [t for t in topics if t.id in self.A]
        if not available_topics:
            return -1

        # Sample from beta distribution for each topic
        topic_samples = []
        for topic in available_topics:
            state = student_state.topic_mastery.get(topic.id)
            if not state:
                continue
            
            alpha = state['alpha']
            beta = state['beta']
            sample = stats.beta.rvs(alpha + 1, beta + 1)
            topic_samples.append((topic, sample))

        if not topic_samples:
            return -1

        # Select topic with highest sample value
        selected_topic = max(topic_samples, key=lambda x: x[1])[0]
        return selected_topic.id

    def update_after_answer(self, topic_id: int, alpha: float, beta: float, mastery_threshold: float) -> Optional[str]:
        mastery = alpha / (alpha + beta) if (alpha + beta) > 0 else 0
        confidence = 1 / (alpha + beta + 1)

        if mastery >= mastery_threshold and confidence >= self.delta:
            self.A.discard(topic_id)
            return 'remove'

        if mastery < mastery_threshold and confidence >= self.delta:
            return 'weak'

        return None

class RandomPolicy(SamplingPolicy):
    def __init__(self, pre_sample_count: int):
        self.A = set()
        self.pre_sample_count = pre_sample_count
        self.initialized = False

    def get_name(self) -> str:
        return 'Random'

    def initialize(self, topics: List[Topic]):
        self.A = {t.id for t in topics}
        self.initialized = True

    def select_topic(self, topics: List[Topic], student_state: StudentState) -> int:
        if not self.initialized:
            self.initialize(topics)

        # Pre-sample phase
        for topic in topics:
            if topic.id not in self.A:
                continue
            Nt = student_state.topic_counts.get(topic.id, 0)
            if Nt < self.pre_sample_count:
                return topic.id

        # Main phase: pick random from A
        available = [t for t in topics if t.id in self.A]
        if not available:
            return -1
        return np.random.choice(available).id

    def update_after_answer(self, topic_id: int, alpha: float, beta: float, mastery_threshold: float) -> Optional[str]:
        mu = alpha / (alpha + beta) if (alpha + beta) > 0 else 0
        
        if mu >= mastery_threshold:
            self.A.discard(topic_id)
            return 'remove'
        elif mu < mastery_threshold:
            return 'weak'
        return None

class AssessmentSimulator:
    def __init__(self, config: Dict):
        self.config = config
        self.results = []

    def calculate_ground_truth_mastery(self, aptitude: float) -> float:
        return aptitude

    def generate_student_data(self) -> Tuple[List[Topic], List[Question], Dict[int, float], List[int]]:
        topics = []
        questions = []
        ground_truth_mastery = {}
        actual_weak_kcs = []

        for i in range(self.config['num_kcs']):
            topic_id = i + 1
            mastery = self.calculate_ground_truth_mastery(self.config['aptitude'])
            ground_truth_mastery[topic_id] = mastery

            if mastery < self.config['mastery_threshold']:
                actual_weak_kcs.append(topic_id)

            topic = Topic(
                id=topic_id,
                name=f"Topic {topic_id}",
                description=f"Description for topic {topic_id}",
                lo_code=f"LO{topic_id}",
                mastery_threshold=self.config['mastery_threshold'],
                confidence_delta=0.05,
                min_samples=3,
                difficulty=0.1 + (i * 0.1),
                concept_weight=1.0,
                time_decay_factor=0.1,
                questions=[],
                has_been_asked=False,
                alpha=np.random.randint(200, 501),
                beta=int(np.random.randint(200, 501) * (1 - mastery) / mastery),
                level=i // 4
            )

            for j in range(self.config['questions_per_kc']):
                question = Question(
                    id=(i * self.config['questions_per_kc']) + j + 1,
                    question_text=f"Question {j + 1} for Topic {topic_id}",
                    explanation=f"Explanation for question {j + 1}",
                    difficulty=0.1 + (j * 0.1),
                    concept_weight=1.0,
                    time_decay_factor=0.1,
                    choices=[
                        {'id': 1, 'question_id': (i * self.config['questions_per_kc']) + j + 1, 'choice': 'A', 'is_correct': True},
                        {'id': 2, 'question_id': (i * self.config['questions_per_kc']) + j + 1, 'choice': 'B', 'is_correct': False},
                        {'id': 3, 'question_id': (i * self.config['questions_per_kc']) + j + 1, 'choice': 'C', 'is_correct': False},
                        {'id': 4, 'question_id': (i * self.config['questions_per_kc']) + j + 1, 'choice': 'D', 'is_correct': False}
                    ],
                    correct_option=0,
                    topic_id=topic_id
                )
                questions.append(question)
                topic.questions.append(question)

            topics.append(topic)

        return topics, questions, ground_truth_mastery, actual_weak_kcs

    def simulate_student(self, student_id: int) -> Dict:
        topics, questions, ground_truth_mastery, actual_weak_kcs = self.generate_student_data()
        student_state = StudentState()
        
        # Initialize sampling policy
        if self.config['algorithm'] == 'HDoC':
            policy = HDoCPolicy(self.config['min_questions_for_confidence'])
        elif self.config['algorithm'] == 'Thompson':
            policy = ThompsonSamplingPolicy(self.config['min_questions_for_confidence'])
        else:
            policy = RandomPolicy(self.config['min_questions_for_confidence'])

        total_questions = 0
        weak_topics = 0
        time_to_detect_weak = 0
        false_positives = 0
        false_negatives = 0
        detected_weak_kcs = []

        while total_questions < self.config['max_questions']:
            # Select topic using policy
            topic_id = policy.select_topic(topics, student_state)
            if topic_id == -1:
                break

            topic = next(t for t in topics if t.id == topic_id)
            if not topic.questions:
                continue

            # Select random question from topic
            question = np.random.choice(topic.questions)
            
            # Simulate answer based on ground truth mastery
            mastery = ground_truth_mastery[topic.id]
            beta_sample = stats.beta.rvs(topic.alpha, topic.beta)
            guess_factor = 1/4  # 4 choices
            p_correct = beta_sample + (1 - beta_sample) * guess_factor
            is_correct = np.random.random() < p_correct

            # Update student state
            student_state.total_questions += 1
            student_state.answered_questions.add(question.id)
            
            if topic.id not in student_state.topic_counts:
                student_state.topic_counts[topic.id] = 0
            student_state.topic_counts[topic.id] += 1

            if topic.id not in student_state.topic_successes:
                student_state.topic_successes[topic.id] = 0
            if topic.id not in student_state.topic_failures:
                student_state.topic_failures[topic.id] = 0

            if is_correct:
                student_state.topic_successes[topic.id] += 1
            else:
                student_state.topic_failures[topic.id] += 1

            # Update mastery state
            alpha = student_state.topic_successes[topic.id]
            beta = student_state.topic_failures[topic.id]
            mastery = alpha / (alpha + beta) if (alpha + beta) > 0 else 0
            confidence = 1 / (alpha + beta + 1)

            student_state.topic_mastery[topic.id] = {
                'alpha': alpha,
                'beta': beta,
                'mastery': mastery,
                'confidence': confidence,
                'questions_asked': student_state.topic_counts[topic.id],
                'last_updated': datetime.now()
            }

            # Check for weak KC
            weak_kc = policy.update_after_answer(
                topic.id,
                alpha,
                beta,
                self.config['mastery_threshold']
            )

            if weak_kc == 'weak':
                if time_to_detect_weak == 0:
                    time_to_detect_weak = total_questions
                weak_topics += 1
                detected_weak_kcs.append(topic.id)

                # Check false positive/negative
                ground_truth_mastery_value = ground_truth_mastery[topic.id]
                if mastery >= self.config['mastery_threshold'] and ground_truth_mastery_value < self.config['mastery_threshold']:
                    false_positives += 1
                elif mastery < self.config['mastery_threshold'] and ground_truth_mastery_value >= self.config['mastery_threshold']:
                    false_negatives += 1

            total_questions += 1

        # Calculate final metrics
        mastery_values = [state['mastery'] for state in student_state.topic_mastery.values()]
        average_mastery = np.mean(mastery_values) if mastery_values else 0
        confidence_values = [state['confidence'] for state in student_state.topic_mastery.values()]
        average_confidence = np.mean(confidence_values) if confidence_values else 0

        return {
            'student_id': student_id,
            'total_questions': total_questions,
            'weak_topics': weak_topics,
            'average_mastery': average_mastery,
            'confidence': average_confidence,
            'time_to_detect_weak': time_to_detect_weak,
            'false_positives': false_positives,
            'false_negatives': false_negatives,
            'accuracy': ((total_questions - (false_positives + false_negatives)) / total_questions * 100) if total_questions > 0 else 0,
            'detected_weak_kcs': detected_weak_kcs,
            'actual_weak_kcs': actual_weak_kcs
        }

    def run_simulation(self):
        print('Starting simulation...')
        print('Config:', self.config)

        for i in range(self.config['num_students']):
            print(f'Simulating student {i + 1}/{self.config["num_students"]}')
            result = self.simulate_student(i + 1)
            self.results.append(result)

        self.analyze_results()

    def analyze_results(self):
        total_students = len(self.results)
        
        average_questions = np.mean([r['total_questions'] for r in self.results])
        average_weak_topics = np.mean([r['weak_topics'] for r in self.results])
        average_mastery = np.mean([r['average_mastery'] for r in self.results])
        average_confidence = np.mean([r['confidence'] for r in self.results])
        average_time_to_detect = np.mean([r['time_to_detect_weak'] for r in self.results])
        total_false_positives = sum(r['false_positives'] for r in self.results)
        total_false_negatives = sum(r['false_negatives'] for r in self.results)
        average_accuracy = np.mean([r['accuracy'] for r in self.results])

        # Calculate precision and recall
        total_precision = 0
        total_recall = 0

        for result in self.results:
            detected_set = set(result['detected_weak_kcs'])
            actual_set = set(result['actual_weak_kcs'])
            
            true_positives = len(detected_set.intersection(actual_set))
            precision = true_positives / len(detected_set) if detected_set else 0
            recall = true_positives / len(actual_set) if actual_set else 0
            
            total_precision += precision
            total_recall += recall

        average_precision = total_precision / total_students
        average_recall = total_recall / total_students
        f1_score = 2 * (average_precision * average_recall) / (average_precision + average_recall) if (average_precision + average_recall) > 0 else 0

        results = {
            'algorithm': self.config['algorithm'],
            'num_kcs': self.config['num_kcs'],
            'questions_per_kc': self.config['questions_per_kc'],
            'total_students': total_students,
            'average_questions': average_questions,
            'average_weak_topics': average_weak_topics,
            'average_mastery': average_mastery,
            'average_confidence': average_confidence,
            'average_time_to_detect': average_time_to_detect,
            'total_false_positives': total_false_positives,
            'total_false_negatives': total_false_negatives,
            'average_accuracy': average_accuracy,
            'average_precision': average_precision,
            'average_recall': average_recall,
            'f1_score': f1_score
        }

        # Save results
        os.makedirs('simulation-results', exist_ok=True)
        filename = f'simulation-results/results_{self.config["algorithm"]}_{self.config["num_kcs"]}_{self.config["questions_per_kc"]}.json'
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2)

        print('\nSimulation Results:')
        print('------------------')
        print(f'Algorithm: {self.config["algorithm"]}')
        print(f'Number of KCs: {self.config["num_kcs"]}')
        print(f'Questions per KC: {self.config["questions_per_kc"]}')
        print(f'Total Students: {total_students}')
        print(f'Average Questions per Student: {average_questions:.2f}')
        print(f'Average Weak Topics Detected: {average_weak_topics:.2f}')
        print(f'Average Mastery: {average_mastery * 100:.2f}%')
        print(f'Average Confidence: {average_confidence * 100:.2f}%')
        print(f'Average Time to Detect Weak Topics: {average_time_to_detect:.2f} questions')
        print(f'False Positives: {total_false_positives}')
        print(f'False Negatives: {total_false_negatives}')
        print(f'Average Accuracy: {average_accuracy:.2f}%')
        print(f'Average Precision: {average_precision * 100:.2f}%')
        print(f'Average Recall: {average_recall * 100:.2f}%')
        print(f'F1 Score: {f1_score * 100:.2f}%')

def run_all_simulations():
    algorithms = ['HDoC', 'Thompson', 'Random']
    num_kcs = [2, 4, 8, 16]
    questions_per_kc = [2, 4, 8, 16]

    for algorithm in algorithms:
        for kcs in num_kcs:
            for q_per_kc in questions_per_kc:
                print(f'\nRunning simulation for {algorithm} with {kcs} KCs and {q_per_kc} questions per KC')
                simulator = AssessmentSimulator({
                    'num_students': 50,
                    'mastery_threshold': 0.7,
                    'confidence_threshold': 0.95,
                    'max_questions': 50,
                    'questions_per_kc': q_per_kc,
                    'algorithm': algorithm,
                    'num_kcs': kcs,
                    'error_rate': 0.15,
                    'aptitude': np.random.random() * 0.9 + 0.1,
                    'w1': 0.6,
                    'w2': 0.4,
                    'min_questions_for_confidence': 3
                })
                simulator.run_simulation()

if __name__ == '__main__':
    run_all_simulations() 