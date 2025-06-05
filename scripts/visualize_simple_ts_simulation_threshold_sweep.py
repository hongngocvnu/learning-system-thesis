# import os
# import glob
# import json
# import numpy as np
# import matplotlib.pyplot as plt

# policies = ['HDoC', 'Thompson']
# colors = ['#4F81BD', '#C0504D']

# def find_latest_result():
#     results_dir = os.path.join(os.path.dirname(__file__), '../simulation-results')
#     files = glob.glob(os.path.join(results_dir, 'simple-ts-simulation-threshold-sweep-*.json'))
#     if not files:
#         raise FileNotFoundError('Không tìm thấy file kết quả simple-ts-simulation-threshold-sweep!')
#     return max(files, key=os.path.getctime)

# def main():
#     result_file = find_latest_result()
#     with open(result_file, 'r') as f:
#         data = json.load(f)
#     thresholds = sorted(list(set(round(d['masteryThreshold'], 2) for d in data)))
#     avg_questions = {policy: [] for policy in policies}
#     accuracies = {policy: [] for policy in policies}
#     for t in thresholds:
#         for i, policy in enumerate(policies):
#             entry = next(d for d in data if abs(d['masteryThreshold'] - t) < 1e-6 and d['policy'] == policy)
#             avg_questions[policy].append(entry['avgQuestions'])
#             accuracies[policy].append(entry['accuracy'])
#     x = np.array(thresholds)
#     fig, ax1 = plt.subplots(figsize=(10, 4))
#     width = 0.04
#     # Barplot cho số câu hỏi trung bình
#     for i, policy in enumerate(policies):
#         ax1.bar(x + (i-0.5)*width, avg_questions[policy], width, label=f'Questions ({policy})', color=colors[i], alpha=0.6)
#     ax1.set_xlabel('Mastery Threshold')
#     ax1.set_ylabel('Question Count')
#     # Lineplot cho accuracy
#     ax2 = ax1.twinx()
#     for i, policy in enumerate(policies):
#         ax2.plot(x, accuracies[policy], color=colors[i], label=f'Accuracy ({policy})', linewidth=2)
#     ax2.set_ylabel('Accuracy')
#     ax2.set_ylim(0, 1)
#     # Gộp legend
#     lines, labels = ax1.get_legend_handles_labels()
#     lines2, labels2 = ax2.get_legend_handles_labels()
#     ax2.legend(lines + lines2, labels + labels2, loc='center left', bbox_to_anchor=(1.05, 0.5))
#     plt.title('Mastery Threshold vs. Question Count and Accuracy (KC=10)')
#     plt.tight_layout()
#     plt.show()

# if __name__ == '__main__':
#     main() 