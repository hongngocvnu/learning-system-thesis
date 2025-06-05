import numpy as np
from typing import List, Dict, Tuple
import json
from dataclasses import dataclass
import matplotlib.pyplot as plt
from tqdm import tqdm
import networkx as nx
from collections import defaultdict
import random
from collections import deque

# Các class và interface từ adaptive-assessment.ts
@dataclass
class Topic:
    id: int
    name: str
    description: str
    lo_code: str
    mastery_threshold: float  # ξ in the paper
    confidence_delta: float   # δ in the paper
    min_samples: int         # Minimum samples required
    difficulty: float
    concept_weight: float
    time_decay_factor: float
    questions: List['Question']
    hasBeenAsked: bool
    alpha: float  # α parameter for Beta distribution
    beta: float   # β parameter for Beta distribution
    prerequisites: List[int]  # Dependencies between KCs
    level: int
    pseudo_reward_factor: float = 2.0  # c in the paper for pseudo-rewards
    true_mastery: float = 0.5  # Added for ground truth

@dataclass
class Question:
    id: int
    question_rich_text: str
    explanation: str
    difficulty: float
    concept_weight: float
    time_decay_factor: float
    choices: List[dict]
    correctOption: int
    topic_id: int
    hasBeenAsked: bool

@dataclass
class AssessmentConfig:
    masteryThreshold: float  # ξ: Threshold for considering a topic mastered/strong
    confidenceThreshold: float  # δ: Error rate for statistical confidence
    preSampleCount: int  # π: Number of initial questions to ask for each LO
    maxQuestions: int  # Budget: Maximum total questions per session
    sampling_policy: str  # MAB algorithm to use

class StudentState:
    def __init__(self):
        self.totalQuestions = 0
        self.answeredQuestions = set()
        self.sessionId = 0
        self.topicMastery = {}  # Map<number, TopicMasteryState>
        self.topicCounts = {}   # Map<number, number>

class SamplingPolicy:
    def __init__(self, name: str):
        self.name = name
        self.A = set()  # Set of available arms
        self.initialized = False

    def initialize(self, topics: List[Topic]):
        self.A = set(t.id for t in topics)
        self.initialized = True

    def selectTopic(self, topics: List[Topic], studentState: StudentState) -> int:
        raise NotImplementedError

    def updateAfterAnswer(self, topicId, alpha, beta, masteryThreshold, delta, K_total_kcs_in_unit, N_i_t_samples_for_topic):
        raise NotImplementedError

class ThompsonSamplingPolicy(SamplingPolicy):
    def __init__(self):
        super().__init__("Thompson")
        
    def selectTopic(self, topics: List[Topic], studentState: StudentState) -> int:
        if not self.initialized:
            self.initialize(topics)
        available_topics = [t for t in topics if t.id in self.A]
        if not available_topics:
            return -1
        min_sample = float('inf')
        selected_topic_id = -1
        for topic in available_topics:
            state = studentState.topicMastery.get(topic.id, {'alpha': 1, 'beta': 1})
            alpha = max(0.001, state['alpha'])
            beta = max(0.001, state['beta'])
            sample = np.random.beta(alpha, beta)
            if sample < min_sample:
                min_sample = sample
                selected_topic_id = topic.id
        return selected_topic_id

    def updateAfterAnswer(self, topicId, alpha, beta, masteryThreshold, delta, K_total_kcs_in_unit, N_i_t_samples_for_topic):
        cdf_alpha = max(0.001, alpha)
        cdf_beta = max(0.001, beta)
        from scipy.stats import beta as beta_dist
        prob = 1 - beta_dist.cdf(masteryThreshold, a=cdf_alpha, b=cdf_beta)
        if prob >= 1 - delta:
            self.A.discard(topicId)
            return 'remove'
        elif prob < delta:
            return 'weak'
        return None

class HDoCPolicy(SamplingPolicy):
    def __init__(self):
        super().__init__("HDoC")
        self.debug = False  # Disable logging
        
    def selectTopic(self, topics: List[Topic], studentState: StudentState) -> int:
        if not self.initialized:
            self.initialize(topics)
        available_topic_objects = [t for t in topics if t.id in self.A]
        if not available_topic_objects:
            return -1

        t = max(1, studentState.totalQuestions)  # Tổng số lượt hỏi
        scores = {}
        for topic_obj in available_topic_objects:
            state = studentState.topicMastery.get(topic_obj.id)
            if not state: continue
            alpha = state['alpha']
            beta = state['beta']
            N_i_t = alpha + beta - 2  # Số lượt hỏi KC này
            if N_i_t <= 0: N_i_t = 1e-6
            mu_hat = alpha / (alpha + beta)
            exploration_term = np.sqrt(np.log(t) / (2 * N_i_t))
            score = mu_hat + exploration_term
            scores[topic_obj.id] = score

        selected_topic_id = min(scores.items(), key=lambda x: x[1])[0] if scores else -1
        return selected_topic_id

    def updateAfterAnswer(self, topicId, alpha, beta, masteryThreshold, delta, K_total_kcs_in_unit, N_i_t_samples_for_topic):
        N_i_t = alpha + beta - 2
        if N_i_t <= 0:
            return None

        mu_hat = alpha / (alpha + beta)
        t = N_i_t  # Số lượt hỏi KC này, dùng cho log(t)
        if t <= 0: t = 1e-6

        confidence_radius = np.sqrt(np.log(t) / (2 * N_i_t))
        mu_bar = mu_hat + confidence_radius

        if mu_hat >= masteryThreshold:
            self.A.discard(topicId)
            return 'remove'
        elif mu_bar < masteryThreshold:
            return 'weak'
        return None

class RandomPolicy(SamplingPolicy):
    def __init__(self):
        super().__init__("Random")
        
    def selectTopic(self, topics: List[Topic], studentState: StudentState) -> int:
        if not self.initialized:
            self.initialize(topics)
            
        available_topics = [t for t in topics if t.id in self.A]
        if not available_topics:
            return -1
        return np.random.choice([t.id for t in available_topics])

    def updateAfterAnswer(self, topicId, alpha, beta, masteryThreshold, delta, K_total_kcs_in_unit, N_i_t_samples_for_topic):
        mu = alpha / (alpha + beta)
        if mu >= masteryThreshold:
            self.A.discard(topicId)
            return 'remove'
        elif mu < masteryThreshold:
            return 'weak'
        return None

def create_simulated_topics(num_kcs: int, config: AssessmentConfig) -> Tuple[List[Topic], nx.DiGraph]:
    """Create simulated topics with dependencies based on random DAG"""
    graph = create_random_dag(num_kcs)
    
    topics = []
    for i in range(num_kcs):
        true_mastery = np.random.beta(3, 3)  # trung bình ~0.5, phân phối đều
        topic = Topic(
            id=i,
            name=f"KC {i}",
            description=f"KC {i}",
            lo_code=f"KC{i}",
            mastery_threshold=config.masteryThreshold,
            confidence_delta=config.confidenceThreshold,
            min_samples=config.preSampleCount,
            difficulty=0.5,
            concept_weight=1.0,
            time_decay_factor=0.1,
            questions=[],
            hasBeenAsked=False,
            alpha=1.0,
            beta=1.0,
            prerequisites=list(graph.predecessors(i)),
            level=len(list(nx.ancestors(graph, i))),
            true_mastery=true_mastery
        )
        topics.append(topic)
    
    return topics, graph

def create_random_dag(num_nodes: int) -> nx.DiGraph:
    G = nx.DiGraph()
    G.add_nodes_from(range(num_nodes))
    
    # Giảm số lượng cạnh tối đa để tránh vòng lặp vô hạn
    max_edges = min(num_nodes * (num_nodes - 1) // 2, num_nodes * 2)
    num_edges = np.random.randint(1, max_edges + 1)
    
    edges_added = 0
    max_attempts = num_nodes * 10  # Giới hạn số lần thử
    attempts = 0
    
    while edges_added < num_edges and attempts < max_attempts:
        source = np.random.randint(0, num_nodes)
        target = np.random.randint(0, num_nodes)
        
        if source != target and not G.has_edge(source, target):
            # Kiểm tra xem việc thêm cạnh có tạo chu trình không
            G.add_edge(source, target)
            if nx.is_directed_acyclic_graph(G):
                edges_added += 1
            else:
                G.remove_edge(source, target)
        
        attempts += 1
    
    return G

def generate_student_mastery_and_params(graph, w1=0.7, w2=0.3, threshold=0.7, alpha_range=(200, 500), guess_choices=4):
    """
    For a given DAG, generate student aptitude, compute ground-truth mastery for each KC,
    assign alpha, beta for each KC, and return all info needed for simulation.
    """
    num_nodes = graph.number_of_nodes()
    aptitude = np.random.uniform(0.1, 1)  # Giảm biên độ
    mastery = {}
    alpha_params = {}
    beta_params = {}
    # Topological sort for breadth-first layer-wise assignment
    topo_order = list(nx.topological_sort(graph))
    # Find root nodes (no prerequisites)
    roots = [n for n in graph.nodes if graph.in_degree(n) == 0]
    # Precompute prerequisites for each node
    prerequisites = {n: list(graph.predecessors(n)) for n in graph.nodes}
    # Layer-wise assignment
    for node in topo_order:
        prereqs = prerequisites[node]
        if not prereqs:
            mastery[node] = aptitude
        else:
            mastered_count = sum(1 for p in prereqs if mastery[p] >= threshold)
            pre_ratio = mastered_count / len(prereqs) if prereqs else 0
            mastery[node] = w1 * aptitude + w2 * pre_ratio
            mastery[node] = min(max(mastery[node], 0.0), 1.0)  # Clamp to [0,1]
        # Assign alpha, beta
        alpha = np.random.randint(alpha_range[0], alpha_range[1]+1)
        mu = mastery[node]
        if mu == 0:
            beta = alpha * 1000  # Large beta for zero mastery
        else:
            beta = alpha * (1 - mu) / mu
        alpha_params[node] = alpha
        beta_params[node] = beta
    return mastery, alpha_params, beta_params, aptitude

def simulate_student_answer(alpha, beta, guess_choices=4):
    sample = np.random.beta(alpha, beta)
    p_correct = sample + (1 - sample) / guess_choices
    return np.random.rand() < p_correct

def simulate_answer(true_mastery: float) -> bool:
    return np.random.rand() < true_mastery

def run_policy_simulation(policy_class, num_kcs: int, num_runs: int, config: AssessmentConfig):
    correct_identifications_total = 0
    total_questions_asked_across_runs = []

    for _ in tqdm(range(num_runs), desc=f"Simulating {policy_class().name} ({num_kcs} KCs)"):
        # 1. KHỞI TẠO CHO MỖI RUN
        graph = create_random_dag(num_kcs) # Tạo cấu trúc phụ thuộc
        mastery_ground_truth, _, _, student_aptitude = generate_student_mastery_and_params(
            graph, w1=0.7, w2=0.3, threshold=config.masteryThreshold
        ) # Tạo năng lực thật

        topics_for_run = []
        weak_ground_truth_ids = set()
        for i in range(num_kcs):
            topic = Topic(
                id=i,
                name=f"KC {i}",
                description=f"KC {i}",
                lo_code=f"KC{i}",
                mastery_threshold=config.masteryThreshold,
                confidence_delta=config.confidenceThreshold,
                min_samples=config.preSampleCount,
                difficulty=0.5,
                concept_weight=1.0,
                time_decay_factor=0.1,
                questions=[],
                hasBeenAsked=False,
                alpha=1.0,
                beta=1.0,
                prerequisites=list(graph.predecessors(i)),
                level=len(list(nx.ancestors(graph, i))),
                true_mastery=mastery_ground_truth.get(i, 0.5)
            )
            topics_for_run.append(topic)
            if topic.true_mastery < config.masteryThreshold:
                weak_ground_truth_ids.add(topic.id)

        student_state = StudentState()
        K_total_kcs = len(topics_for_run)
        # SỬA: Khởi tạo HDoCPolicy với tham số chuẩn
        if policy_class.__name__ == "HDoCPolicy":
            policy = HDoCPolicy()
        else:
        policy = policy_class()
        policy.initialize(topics_for_run) # Khởi tạo self.A cho policy
        if hasattr(policy, 'reset_adaptive_round_count'):
            policy.reset_adaptive_round_count()

        # 2. PHA 1: PRE-SAMPLE
        for topic in topics_for_run:
            for _ in range(config.preSampleCount):
                if student_state.totalQuestions >= config.maxQuestions: break
                
                answer = simulate_answer(topic.true_mastery) # Sinh viên mô phỏng trả lời
                
                # Cập nhật alpha, beta trong studentState.topicMastery
                if topic.id not in student_state.topicMastery:
                    student_state.topicMastery[topic.id] = {'alpha': 1.0, 'beta': 1.0}
                current_mastery_state = student_state.topicMastery[topic.id]
                if answer:
                    current_mastery_state['alpha'] += 1
                else:
                    current_mastery_state['beta'] += 1
                student_state.totalQuestions += 1
            if student_state.totalQuestions >= config.maxQuestions: break
        if student_state.totalQuestions >= config.maxQuestions: # Nếu hết budget ngay trong pre-sample
            # Xử lý accuracy cho trường hợp này (ví dụ, không tìm thấy weak KC)
            if len(weak_ground_truth_ids) == 0: # Đúng nếu không có weak KC thật và không tìm thấy gì
                 correct_identifications_total +=1
            total_questions_asked_across_runs.append(student_state.totalQuestions)
            continue # Chuyển sang run tiếp theo

        # 3. PHA 2: ADAPTIVE
        predicted_weakest_id_this_run = None
        adaptive_round_count = 0
        while student_state.totalQuestions < config.maxQuestions and policy.A: # Còn budget và còn KC trong A
            adaptive_round_count += 1
            
            if policy_class.__name__ == "HDoCPolicy":
                selected_topic_id = policy.selectTopic(topics_for_run, student_state)
            else:
                selected_topic_id = policy.selectTopic(topics_for_run, student_state)
            
            if selected_topic_id == -1: # Không chọn được topic nào nữa (ví dụ policy.A rỗng)
                break

            selected_topic = next(t for t in topics_for_run if t.id == selected_topic_id)
            answer = simulate_answer(selected_topic.true_mastery)
            
            current_mastery_state = student_state.topicMastery[selected_topic.id]
            if answer:
                current_mastery_state['alpha'] += 1
            else:
                current_mastery_state['beta'] += 1
            student_state.totalQuestions += 1

            # Tính N_i_t cho topic vừa hỏi
            N_i_t_for_selected_topic = current_mastery_state['alpha'] + current_mastery_state['beta'] - 2 # Nếu khởi tạo 1,1

            result_after_answer = policy.updateAfterAnswer(
                topicId=selected_topic.id,
                alpha=current_mastery_state['alpha'],
                beta=current_mastery_state['beta'],
                masteryThreshold=config.masteryThreshold,
                delta=config.confidenceThreshold,
                K_total_kcs_in_unit=K_total_kcs,
                N_i_t_samples_for_topic=N_i_t_for_selected_topic
            )

            if result_after_answer == 'weak':
                # Propagate pseudo-reward to children
                for child in graph.successors(selected_topic.id):
                    child_state = student_state.topicMastery[child]
                    child_state['beta'] += 2  # hoặc 1, tuỳ mức độ propagation mong muốn
                predicted_weakest_id_this_run = selected_topic.id
                break
            # Nếu result_after_answer == 'remove', policy đã tự loại KC đó khỏi self.A

        # 4. TÍNH TOÁN ACCURACY CHO RUN NÀY
        found_weak_correctly = False
        if predicted_weakest_id_this_run is not None and \
           predicted_weakest_id_this_run in weak_ground_truth_ids:
            found_weak_correctly = True
        
        if (len(weak_ground_truth_ids) > 0 and found_weak_correctly) or \
           (len(weak_ground_truth_ids) == 0 and predicted_weakest_id_this_run is None):
            correct_identifications_total += 1
        
        total_questions_asked_across_runs.append(student_state.totalQuestions)

    # SAU KHI HOÀN THÀNH TẤT CẢ CÁC RUNS
    final_accuracy = correct_identifications_total / num_runs
    average_questions = np.mean(total_questions_asked_across_runs)
    
    return final_accuracy, average_questions

def main():
    # Configuration matching real model parameters
    config = AssessmentConfig(
        masteryThreshold=0.7,
        confidenceThreshold=0.15,  # giảm xuống
        preSampleCount=1,          # tăng lên
        maxQuestions=80,           # giảm nếu cần
        sampling_policy='any'
    )
    
    # KC counts from 2 to 16
    kc_counts = range(2, 17)
    num_runs = 3000
    
    results = {
        'Thompson': {'accuracy': [], 'avg_questions': [], 'std_questions': []},
        'HDoC': {'accuracy': [], 'avg_questions': [], 'std_questions': []},
        'Random': {'accuracy': [], 'avg_questions': [], 'std_questions': []}
    }
    
    for num_kcs in kc_counts:
        print(f"\nSimulating with {num_kcs} KCs...")
        for policy_class in [ThompsonSamplingPolicy, HDoCPolicy, RandomPolicy]:
            policy_name = policy_class.__name__.replace("SamplingPolicy", "").replace("Policy", "")
            print(f"Running {policy_name}...")
            policy_results = run_policy_simulation(policy_class, num_kcs=num_kcs, num_runs=num_runs, config=config)
            results[policy_name]['accuracy'].append(policy_results[0])
            results[policy_name]['avg_questions'].append(policy_results[1])
            results[policy_name]['std_questions'].append(0)  # Assuming no standard deviation for this simulation
            print(f"{policy_name} Results:")
            print(f"Accuracy: {policy_results[0]:.3f}")
            print(f"Avg Questions: {policy_results[1]:.1f}")
            print("---")
    
    # Plot results
    plt.figure(figsize=(12, 4))  # Tăng chiều rộng để có chỗ cho legend
    kc_counts_arr = np.array(list(kc_counts))
    bar_width = 0.25
    x = np.arange(len(kc_counts_arr))
    
    # Bar chart: average questions
    ax1 = plt.gca()
    bars1 = ax1.bar(x - bar_width, results['Thompson']['avg_questions'], 
                    width=bar_width, color='#7fa7e6', alpha=0.7, label='Thompson Q')
    bars2 = ax1.bar(x, results['HDoC']['avg_questions'], 
                    width=bar_width, color='#7fe67f', alpha=0.7, label='HDoC Q')
    bars3 = ax1.bar(x + bar_width, results['Random']['avg_questions'], 
                    width=bar_width, color='#e67f7f', alpha=0.7, label='Random Q')
    
    ax1.set_xlabel('KC count')
    ax1.set_ylabel('Question Count')
    ax1.set_xticks(x)
    ax1.set_xticklabels(kc_counts_arr)
    ax1.set_ylim(0, max(max(results['Thompson']['avg_questions']), 
                        max(results['HDoC']['avg_questions']), 
                        max(results['Random']['avg_questions'])) + 5)
    
    # Line chart: accuracy
    ax2 = ax1.twinx()
    l1, = ax2.plot(x, results['Thompson']['accuracy'], 
                   color='#2c5aa0', linewidth=2, label='Thompson Acc')
    l2, = ax2.plot(x, results['HDoC']['accuracy'], 
                   color='#2ca02c', linewidth=2, label='HDoC Acc')
    l3, = ax2.plot(x, results['Random']['accuracy'], 
                   color='#c0392b', linewidth=2, label='Random Acc')
    
    ax2.set_ylabel('Accuracy')
    ax2.set_ylim(0, 1.0)  # Thay đổi phạm vi accuracy từ 0 đến 1
    
    plt.title('Question Count and Accuracy vs KC Count', fontsize=14, fontweight='bold', y=1.05)
    
    # Tạo legend riêng biệt và đặt nó bên ngoài biểu đồ
    lines, labels = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    
    # Tạo figure mới cho legend
    legend_fig = plt.figure(figsize=(12, 0.5))
    legend_ax = legend_fig.add_subplot(111)
    legend_ax.axis('off')
    
    # Thêm legend vào figure mới
    legend = legend_ax.legend(
        lines + [l1, l2, l3],
        labels + ['Thompson Acc', 'HDoC Acc', 'Random Acc'],
        loc='center',
        ncol=6,
        frameon=False
    )
    
    # Lưu biểu đồ chính
    plt.figure(1)  # Chuyển về figure chính
    plt.tight_layout()
    plt.savefig('simulation_results.png', dpi=200, bbox_inches='tight')
    plt.close()
    
    # Lưu legend riêng
    legend_fig.savefig('simulation_legend.png', dpi=200, bbox_inches='tight')
    plt.close(legend_fig)
    
    # Save detailed results
    with open('simulation_results.json', 'w') as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    main() 