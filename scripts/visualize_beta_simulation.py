# import os
# import glob
# import json
# import numpy as np
# import matplotlib.pyplot as plt

# sampling_policies = ['HDoC', 'Thompson', 'Random']
# colors = ['#4F81BD', '#C0504D', '#9BBB59']

# # Tìm file kết quả mới nhất
# def find_latest_result():
#     results_dir = os.path.join(os.path.dirname(__file__), '../simulation-results')
#     files = glob.glob(os.path.join(results_dir, 'beta-simulation-summary-*.json'))
#     if not files:
#         raise FileNotFoundError('Không tìm thấy file kết quả beta-simulation-summary!')
#     return max(files, key=os.path.getctime)

# def main():
#     result_file = find_latest_result()
#     with open(result_file, 'r') as f:
#         data = json.load(f)
#     lo_counts = sorted([int(k) for k in data.keys()])
#     avg_questions = {policy: [] for policy in sampling_policies}
#     accuracies = {policy: [] for policy in sampling_policies}
#     for lo in lo_counts:
#         for i, policy in enumerate(sampling_policies):
#             avg_questions[policy].append(data[str(lo)][policy]['avg_questions'])
#             accuracies[policy].append(data[str(lo)][policy]['accuracy'])
#     x = np.arange(len(lo_counts))
#     width = 0.2
#     fig, ax1 = plt.subplots(figsize=(10, 4))
#     # Barplot cho số câu hỏi trung bình
#     for i, policy in enumerate(sampling_policies):
#         ax1.bar(x + i*width - width, avg_questions[policy], width, label=f'Questions ({policy})', color=colors[i], alpha=0.6)
#     ax1.set_xlabel('KC count')
#     ax1.set_ylabel('Average Question Count to Identify Weak LO')
#     ax1.set_xticks(x)
#     ax1.set_xticklabels(lo_counts)
#     # Lineplot cho accuracy
#     ax2 = ax1.twinx()
#     for i, policy in enumerate(sampling_policies):
#         ax2.plot(x, accuracies[policy], color=colors[i], label=f'Accuracy ({policy})', linewidth=2)
#     ax2.set_ylabel('Accuracy')
#     ax2.set_ylim(0, 1)
#     # Gộp legend
#     lines, labels = ax1.get_legend_handles_labels()
#     lines2, labels2 = ax2.get_legend_handles_labels()
#     ax2.legend(lines + lines2, labels + labels2, loc='upper right')
#     plt.title('Average Question Count and Accuracy vs. KC count\n(Question Count = average number of questions to identify the first weak LO)')
#     plt.tight_layout()
#     plt.show()

# if __name__ == '__main__':
#     main() 