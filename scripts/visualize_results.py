# import matplotlib.pyplot as plt
# import seaborn as sns
# import json
# import os
# import glob

# # Hàm tải kết quả từ file JSON
# def load_results(file_path):
#     with open(file_path, 'r') as f:
#         return json.load(f)

# # Hàm trực quan hóa kết quả
# def visualize_results(results, lo_count):
#     plt.figure(figsize=(12, 6))
#     sns.boxplot(data=results['rawResults'])
#     plt.title(f'Raw Results for {lo_count} LOs')
#     plt.xlabel('Learning Objective')
#     plt.ylabel('Score')
#     plt.show()

#     plt.figure(figsize=(12, 6))
#     sns.boxplot(data=results['analyzedResults'])
#     plt.title(f'Analyzed Results for {lo_count} LOs')
#     plt.xlabel('Learning Objective')
#     plt.ylabel('Score')
#     plt.show()

# # Hàm chính
# def main():
#     results_dir = os.path.join(os.path.dirname(__file__), '../simulation-results')
#     for lo_count in range(2, 17):
#         file_pattern = os.path.join(results_dir, f'simulation-results-{lo_count}-LOs-*.json')
#         files = glob.glob(file_pattern)
#         if files:
#             latest_file = max(files, key=os.path.getctime)
#             results = load_results(latest_file)
#             visualize_results(results, lo_count)

# if __name__ == '__main__':
#     main() 