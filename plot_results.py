import matplotlib.pyplot as plt
import numpy as np

# Dữ liệu mẫu - bạn có thể thay thế bằng dữ liệu thực tế từ kết quả mô phỏng
algorithms = ['Thompson Sampling', 'HDoC', 'Random']
metrics = ['Accuracy', 'Average Questions', 'STD Questions']

# Dữ liệu mẫu - thay thế bằng kết quả thực tế của bạn
data = {
    'Thompson Sampling': {
        'Accuracy': 0.85,
        'Average Questions': 25,
        'STD Questions': 5
    },
    'HDoC': {
        'Accuracy': 0.82,
        'Average Questions': 28,
        'STD Questions': 6
    },
    'Random': {
        'Accuracy': 0.75,
        'Average Questions': 35,
        'STD Questions': 8
    }
}

# Tạo figure với 3 subplot
fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(15, 5))

# Vẽ biểu đồ Accuracy
accuracies = [data[alg]['Accuracy'] for alg in algorithms]
ax1.bar(algorithms, accuracies, color=['#2ecc71', '#3498db', '#e74c3c'])
ax1.set_title('Accuracy Comparison')
ax1.set_ylim(0, 1)
ax1.set_ylabel('Accuracy')
ax1.grid(True, linestyle='--', alpha=0.7)

# Vẽ biểu đồ Average Questions
avg_questions = [data[alg]['Average Questions'] for alg in algorithms]
ax2.bar(algorithms, avg_questions, color=['#2ecc71', '#3498db', '#e74c3c'])
ax2.set_title('Average Questions Comparison')
ax2.set_ylabel('Number of Questions')
ax2.grid(True, linestyle='--', alpha=0.7)

# Vẽ biểu đồ STD Questions
std_questions = [data[alg]['STD Questions'] for alg in algorithms]
ax3.bar(algorithms, std_questions, color=['#2ecc71', '#3498db', '#e74c3c'])
ax3.set_title('STD Questions Comparison')
ax3.set_ylabel('Standard Deviation')
ax3.grid(True, linestyle='--', alpha=0.7)

# Điều chỉnh layout
plt.tight_layout()

# Lưu biểu đồ
plt.savefig('mab_comparison.png', dpi=300, bbox_inches='tight')
plt.close() 