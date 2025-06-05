import json
import matplotlib.pyplot as plt
import numpy as np
from tabulate import tabulate

def visualize_results():
    # Read the simulation results
    with open('simulation_results_ts_threshold.json', 'r') as f:
        results = json.load(f)

    # Extract data
    thresholds_str = sorted(results.keys())
    thresholds = [float(t) for t in thresholds_str]
    policies = list(results[thresholds_str[0]].keys())

    # Separate data by policy
    accuracy_data = {policy: [] for policy in policies}
    avg_questions_data = {policy: [] for policy in policies}
    f1_score_data = {policy: [] for policy in policies}
    precision_data = {policy: [] for policy in policies}

    # Extract all metrics
    for threshold_str in thresholds_str:
        for policy in policies:
            accuracy_data[policy].append(results[threshold_str][policy]['accuracy'])
            avg_questions_data[policy].append(results[threshold_str][policy]['avg_questions'])
            f1_score_data[policy].append(results[threshold_str][policy]['f1_score'])
            precision_data[policy].append(results[threshold_str][policy]['precision'])

    # Calculate average metrics for each policy
    summary_data = []
    for policy in policies:
        avg_accuracy = np.mean(accuracy_data[policy])
        avg_questions = np.mean(avg_questions_data[policy])
        avg_f1 = np.mean(f1_score_data[policy])
        avg_precision = np.mean(precision_data[policy])
        
        summary_data.append([
            policy,
            f"{avg_accuracy:.3f}",
            f"{avg_questions:.1f}",
            f"{avg_f1:.3f}",
            f"{avg_precision:.3f}"
        ])

    # Create figure with 3x2 subplots (2x2 for plots, 1x2 for table)
    fig = plt.figure(figsize=(15, 18))
    gs = fig.add_gridspec(3, 2, height_ratios=[1, 1, 0.5])

    # Create subplots for plots
    ax1 = fig.add_subplot(gs[0, 0])
    ax2 = fig.add_subplot(gs[0, 1])
    ax3 = fig.add_subplot(gs[1, 0])
    ax4 = fig.add_subplot(gs[1, 1])
    ax_table = fig.add_subplot(gs[2, :])

    # Define consistent colors for each policy
    policy_colors = {
        'Thompson': 'skyblue',
        'HDoC': 'lightgreen',
        'Random': 'salmon',
    }

    policy_order = ['Thompson', 'HDoC', 'Random']
    x = np.arange(len(thresholds))
    bar_width = 0.25

    # Plot 1: Question Count
    for policy in policy_order:
        ax1.bar(
            x + (policy_order.index(policy) - 1) * bar_width,
            avg_questions_data[policy],
            color=policy_colors[policy],
            width=bar_width,
            edgecolor='grey',
            label=policy
        )
    ax1.set_xlabel('Mastery Threshold')
    ax1.set_ylabel('Question Count')
    ax1.set_title('Average Questions Asked')
    ax1.set_xticks(x)
    ax1.set_xticklabels(thresholds_str)
    ax1.set_ylim(0, 80)
    ax1.grid(True, linestyle='--', alpha=0.7)

    # Plot 2: Accuracy
    for policy in policy_order:
        ax2.plot(
            x,
            accuracy_data[policy],
            color=policy_colors[policy],
            marker='o',
            label=policy,
            linewidth=2
        )
    ax2.set_xlabel('Mastery Threshold')
    ax2.set_ylabel('Accuracy')
    ax2.set_title('Accuracy')
    ax2.set_xticks(x)
    ax2.set_xticklabels(thresholds_str)
    ax2.set_ylim(0, 1.05)
    ax2.grid(True, linestyle='--', alpha=0.7)

    # Plot 3: F1 Score
    for policy in policy_order:
        ax3.plot(
            x,
            f1_score_data[policy],
            color=policy_colors[policy],
            marker='o',
            label=policy,
            linewidth=2
        )
    ax3.set_xlabel('Mastery Threshold')
    ax3.set_ylabel('F1 Score')
    ax3.set_title('F1 Score')
    ax3.set_xticks(x)
    ax3.set_xticklabels(thresholds_str)
    ax3.set_ylim(0, 1.05)
    ax3.grid(True, linestyle='--', alpha=0.7)

    # Plot 4: Precision
    for policy in policy_order:
        ax4.plot(
            x,
            precision_data[policy],
            color=policy_colors[policy],
            marker='o',
            label=policy,
            linewidth=2
        )
    ax4.set_xlabel('Mastery Threshold')
    ax4.set_ylabel('Precision')
    ax4.set_title('Precision')
    ax4.set_xticks(x)
    ax4.set_xticklabels(thresholds_str)
    ax4.set_ylim(0, 1.05)
    ax4.grid(True, linestyle='--', alpha=0.7)

    # Add legend to all subplots
    for ax in [ax1, ax2, ax3, ax4]:
        ax.legend(loc='best')

    # Create table
    table_data = [['Policy', 'Accuracy', 'Avg Questions', 'F1 Score', 'Precision']] + summary_data
    table = ax_table.table(
        cellText=table_data,
        loc='center',
        cellLoc='center',
        colWidths=[0.2, 0.2, 0.2, 0.2, 0.2]
    )
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 1.5)
    ax_table.axis('off')
    ax_table.set_title('Summary of Average Metrics by Policy', pad=20)

    # Adjust layout and save
    fig.tight_layout()
    plt.savefig('simulation_results_combined_2.png', dpi=300, bbox_inches='tight')
    plt.close()

    print("\nCombined visualization saved as 'simulation_results_combined_2.png'")

if __name__ == '__main__':
    visualize_results() 