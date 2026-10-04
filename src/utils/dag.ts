/**
 * Directed Acyclic Graph (DAG) utilities for task scheduling
 */

export interface DagNode {
  id: string;
  dependencies: string[];
}

export function detectCycles(nodes: DagNode[]): { hasCycle: boolean; cyclePath?: string[] } {
  const nodeMap = new Map<string, DagNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId)) return true;
        } else if (recursionStack.has(depId)) {
          path.push(depId);
          return true;
        }
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        return { hasCycle: true, cyclePath: [...path] };
      }
    }
  }

  return { hasCycle: false };
}

export function topologicalSort(nodes: DagNode[]): string[] {
  const nodeMap = new Map<string, DagNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const visited = new Set<string>();
  const result: string[] = [];

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) {
      for (const depId of node.dependencies) {
        visit(depId);
      }
    }
    result.push(nodeId);
  }

  for (const node of nodes) {
    visit(node.id);
  }

  return result;
}
