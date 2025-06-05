# import numpy as np
# import pandas as pd
# import json
# import os
# from datetime import datetime

# # Cấu hình mô phỏng
# basic_config = {
#     'numStudents': 100,  # 100 học viên
#     'numTopics': 10,     # 10 chủ đề
#     'questionsPerTopic': 20,  # 20 câu hỏi/chủ đề
#     'sessionsPerStudent': 3,  # Mỗi học viên test 3 lần
#     'maxQuestionsPerSession': 40,  # Tối đa 40 câu/lần test
#     'samplingPolicies': ['Thompson', 'HDoC', 'Random']
# }

# # Hàm mô phỏng
# def run_assessment_simulation(config, lo_count):
#     print(f'Starting simulation with {lo_count} LOs...')
#     # Giả lập kết quả mô phỏng
#     results = {
#         'rawResults': np.random.rand(config['numStudents'], lo_count).tolist(),
#         'analyzedResults': np.random.rand(config['numStudents'], lo_count).tolist()
#     }
#     return results

# # Hàm chính
# def main():
#     print('Starting simulation with basic configuration...')
#     print('Configuration:', basic_config)
#     for lo_count in range(2, 17):
#         try:
#             results = run_assessment_simulation(basic_config, lo_count)
#             print(f'\nSimulation completed successfully for {lo_count} LOs!')
#             # Lưu kết quả vào file
#             output_dir = os.path.join(os.path.dirname(__file__), '../simulation-results')
#             if not os.path.exists(output_dir):
#                 os.makedirs(output_dir)
#             timestamp = datetime.now().strftime('%Y-%m-%d-%H-%M-%S')
#             output_file = os.path.join(output_dir, f'simulation-results-{lo_count}-LOs-{timestamp}.json')
#             with open(output_file, 'w') as f:
#                 json.dump(results, f, indent=2)
#             print(f'Results saved to: {output_file}')
#         except Exception as e:
#             print(f'Error running simulation for {lo_count} LOs:', e)

# if __name__ == '__main__':
#     main() 