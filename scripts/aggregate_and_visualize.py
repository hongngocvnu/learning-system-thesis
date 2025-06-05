# import os
# import glob
# import json
# import numpy as np
# import matplotlib.pyplot as plt

# sampling_policies = ['HDoC', 'Thompson', 'Random']
# lo_counts = list(range(2, 17))

# # Hàm giả lập nhãn ground truth và predicted từ analyzedResults
# # (ở đây: ground_truth = điểm thực > 0.5, predicted = điểm dự đoán > 0.5)
# def simulate_labels(analyzed_results):
#     analyzed_results = np.array(analyzed_results)
#     # Giả lập: ground_truth là random nhị phân, predicted dựa trên điểm
#     ground_truth = (np.random.rand(*analyzed_results.shape) > 0.5).astype(int)
#     predicted = (analyzed_results > 0.5).astype(int)
#     return ground_truth, predicted

# def compute_accuracy(ground_truth, predicted):
#     correct = (ground_truth == predicted).sum()
#     total = ground_truth.size
#     return correct / total if total > 0 else 0

# def main():
#     results_dir = os.path.join(os.path.dirname(__file__), '../simulation-results')
#     avg_questions = {policy: [] for policy in sampling_policies}
#     accuracies = {policy: [] for policy in sampling_policies}

#     for lo_count in lo_counts:
#         file_pattern = os.path.join(results_dir, f'simulation-results-{lo_count}-LOs-*.json')
#         files = glob.glob(file_pattern)
#         if not files:
#             for policy in sampling_policies:
#                 avg_questions[policy].append(np.nan)
#                 accuracies[policy].append(np.nan)
#             continue
#         latest_file = max(files, key=os.path.getctime)
#         with open(latest_file, 'r') as f:
#             data = json.load(f)
#         # Giả lập: mỗi policy là một cột trong rawResults/analyzedResults
#         for i, policy in enumerate(sampling_policies):
#             # Số câu hỏi trung bình: số hàng (học viên) * số cột (LO)
#             num_questions = np.array(data['rawResults']).shape[1]
#             avg_questions[policy].append(num_questions)
#             # Giả lập nhãn và tính accuracy
#             ground_truth, predicted = simulate_labels(data['analyzedResults'])
#             acc = compute_accuracy(ground_truth, predicted)
#             accuracies[policy].append(acc)

#     # Vẽ biểu đồ
#     fig, ax1 = plt.subplots(figsize=(10, 4))
#     width = 0.2
#     x = np.arange(len(lo_counts))
#     colors = ['#4F81BD', '#C0504D', '#9BBB59']
#     # Barplot cho số câu hỏi
#     for i, policy in enumerate(sampling_policies):
#         ax1.bar(x + i*width - width, avg_questions[policy], width, label=f'Questions ({policy})', color=colors[i], alpha=0.6)
#     ax1.set_xlabel('KC count')
#     ax1.set_ylabel('Question Count')
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
#     plt.tight_layout()
#     plt.show()

# if __name__ == '__main__':
#     main() 