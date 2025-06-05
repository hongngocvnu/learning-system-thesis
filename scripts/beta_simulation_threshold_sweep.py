# import numpy as np
# import json
# import os
# from datetime import datetime
# import random

# sampling_policies = ['HDoC', 'Thompson', 'Random']
# lo_counts = [10]
# num_students = 200
# sessions_per_student = 3
# max_questions_per_session = 40
# mastery_thresholds = [round(x, 1) for x in np.arange(0.3, 1.0, 0.1)]

# def select_lo(policy, mastery_probs, mastery_threshold):
#     if policy == 'Random':
#         return random.randint(0, len(mastery_probs)-1)
#     elif policy == 'Thompson':
#         return np.argmin(mastery_probs)
#     elif policy == 'HDoC':
#         below = [i for i, p in enumerate(mastery_probs) if p < mastery_threshold]
#         if below:
#             return below[np.argmin([abs(p-mastery_threshold) for i, p in enumerate(mastery_probs) if i in below])]
#         else:
#             return np.argmin(mastery_probs)
#     else:
#         return random.randint(0, len(mastery_probs)-1)

# def simulate_student(lo_count, policy, ground_truth_lo, mastery_threshold):
#     a = np.ones(lo_count)
#     b = np.ones(lo_count)
#     total_questions = 0
#     for session in range(sessions_per_student):
#         for q in range(max_questions_per_session):
#             mastery_probs = a / (a + b)
#             predicted_weak_lo = np.argmin(mastery_probs)
#             if predicted_weak_lo == ground_truth_lo and mastery_probs[predicted_weak_lo] < mastery_threshold:
#                 return total_questions + 1, predicted_weak_lo
#             lo = select_lo(policy, mastery_probs, mastery_threshold)
#             if lo == ground_truth_lo:
#                 correct = np.random.rand() < 0.3
#             else:
#                 correct = np.random.rand() < 0.8
#             if correct:
#                 a[lo] += 1
#             else:
#                 b[lo] += 1
#             total_questions += 1
#     mastery_probs = a / (a + b)
#     predicted_weak_lo = np.argmin(mastery_probs)
#     return total_questions, predicted_weak_lo

# def main():
#     all_results = {}
#     for threshold in mastery_thresholds:
#         results = {}
#         for lo_count in lo_counts:
#             results[lo_count] = {}
#             for policy in sampling_policies:
#                 total_questions_list = []
#                 correct_count = 0
#                 for student in range(num_students):
#                     ground_truth_lo = np.random.randint(0, lo_count)
#                     num_questions, predicted_weak_lo = simulate_student(lo_count, policy, ground_truth_lo, threshold)
#                     total_questions_list.append(num_questions)
#                     if predicted_weak_lo == ground_truth_lo:
#                         correct_count += 1
#                 avg_questions = np.mean(total_questions_list)
#                 accuracy = correct_count / num_students
#                 results[lo_count][policy] = {
#                     'avg_questions': avg_questions,
#                     'accuracy': accuracy
#                 }
#         all_results[threshold] = results
#     # Lưu kết quả
#     output_dir = os.path.join(os.path.dirname(__file__), '../simulation-results')
#     if not os.path.exists(output_dir):
#         os.makedirs(output_dir)
#     timestamp = datetime.now().strftime('%Y-%m-%d-%H-%M-%S')
#     output_file = os.path.join(output_dir, f'beta-simulation-threshold-sweep-{timestamp}.json')
#     with open(output_file, 'w') as f:
#         json.dump(all_results, f, indent=2)
#     print(f'Results saved to: {output_file}')

# if __name__ == '__main__':
#     main() 