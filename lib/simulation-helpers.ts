import { Topic } from './adaptive-assessment';
import * as jStat from 'jstat';

// Simple DAG implementation
export class DAG {
  private nodes: Set<number>;
  private edges: Map<number, Set<number>>;
  private inDegree: Map<number, number>;

  constructor() {
    this.nodes = new Set();
    this.edges = new Map();
    this.inDegree = new Map();
  }

  addNode(node: number): void {
    this.nodes.add(node);
    if (!this.edges.has(node)) {
      this.edges.set(node, new Set());
    }
    if (!this.inDegree.has(node)) {
      this.inDegree.set(node, 0);
    }
  }

  addEdge(from: number, to: number): boolean {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      return false;
    }

    // Check if adding this edge would create a cycle
    if (this.wouldCreateCycle(from, to)) {
      return false;
    }

    this.edges.get(from)!.add(to);
    this.inDegree.set(to, (this.inDegree.get(to) || 0) + 1);
    return true;
  }

  private wouldCreateCycle(from: number, to: number): boolean {
    const visited = new Set<number>();
    const stack = new Set<number>();

    const dfs = (node: number): boolean => {
      visited.add(node);
      stack.add(node);

      const neighbors = this.edges.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (stack.has(neighbor)) {
          return true;
        }
      }

      stack.delete(node);
      return false;
    };

    // Add the new edge temporarily
    this.edges.get(from)!.add(to);
    this.inDegree.set(to, (this.inDegree.get(to) || 0) + 1);

    // Check for cycles
    const hasCycle = dfs(from);

    // Remove the temporary edge
    this.edges.get(from)!.delete(to);
    this.inDegree.set(to, (this.inDegree.get(to) || 0) - 1);

    return hasCycle;
  }

  getPredecessors(node: number): Set<number> {
    const predecessors = new Set<number>();
    for (const [from, toSet] of this.edges.entries()) {
      if (toSet.has(node)) {
        predecessors.add(from);
      }
    }
    return predecessors;
  }

  getSuccessors(node: number): Set<number> {
    return this.edges.get(node) || new Set();
  }

  getAncestors(node: number): Set<number> {
    const ancestors = new Set<number>();
    const visited = new Set<number>();

    const dfs = (current: number) => {
      visited.add(current);
      const predecessors = this.getPredecessors(current);
      for (const pred of predecessors) {
        if (!visited.has(pred)) {
          ancestors.add(pred);
          dfs(pred);
        }
      }
    };

    dfs(node);
    return ancestors;
  }

  getLevel(node: number): number {
    return this.getAncestors(node).size;
  }

  getNodes(): Set<number> {
    return this.nodes;
  }
}

export function createRandomDag(numNodes: number): DAG {
  const graph = new DAG();
  
  // Add all nodes
  for (let i = 0; i < numNodes; i++) {
    graph.addNode(i);
  }
  
  // Calculate maximum number of edges to avoid too dense graphs
  const maxEdges = Math.min(numNodes * (numNodes - 1) / 2, numNodes * 2);
  const numEdges = Math.floor(Math.random() * maxEdges) + 1;
  
  let edgesAdded = 0;
  let attempts = 0;
  const maxAttempts = numNodes * 10;
  
  while (edgesAdded < numEdges && attempts < maxAttempts) {
    const source = Math.floor(Math.random() * numNodes);
    const target = Math.floor(Math.random() * numNodes);
    
    if (source !== target && graph.addEdge(source, target)) {
      edgesAdded++;
    }
    attempts++;
  }
  
  return graph;
}

export async function generateStudentMasteryAndParams(
  graph: DAG,
  w1: number,
  w2: number,
  threshold: number
): Promise<{ mastery: Map<number, number> }> {
  const numNodes = graph.getNodes().size;
  const aptitude = Math.random() * 0.9 + 0.1; // Random aptitude between 0.1 and 1.0
  const mastery = new Map<number, number>();
  
  // Get topological order for breadth-first layer-wise assignment
  const nodes = Array.from(graph.getNodes()).sort((a, b) => {
    const levelA = graph.getLevel(a);
    const levelB = graph.getLevel(b);
    return levelA - levelB;
  });
  
  for (const node of nodes) {
    const prerequisites = Array.from(graph.getPredecessors(node));
    
    if (prerequisites.length === 0) {
      mastery.set(node, aptitude);
    } else {
      const masteredCount = prerequisites.filter(p => (mastery.get(p) || 0) >= threshold).length;
      const preRatio = masteredCount / prerequisites.length;
      const nodeMastery = w1 * aptitude + w2 * preRatio;
      mastery.set(node, Math.max(0, Math.min(1, nodeMastery)));
    }
  }
  
  return { mastery };
}

export function simulateAnswer(trueMastery: number): boolean {
  return Math.random() < trueMastery;
}

export function empiricalMean(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

export function calculateConfidenceMetric(alpha: number, beta: number): number {
  return 1 / (alpha + beta + 1);
} 