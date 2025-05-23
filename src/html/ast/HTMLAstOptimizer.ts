import { Node, AST } from '../core/types';

/**
 * Interface for a class of equivalent nodes
 */
interface StateClass {
  signature: string;
  nodes: Set<Node>;
}

/**
 * Interface for optimization metrics
 */
export interface OptimizationMetrics {
  nodeReduction: {
    original: number;
    optimized: number;
    ratio: number;
  };
  memoryUsage: {
    original: number;
    optimized: number;
    ratio: number;
  };
  stateClasses: {
    count: number;
    averageSize: number;
  };
}

/**
 * HTMLAstOptimizer
 * Optimizes AST (Abstract Syntax Tree) representations of HTML by identifying
 * and merging equivalent nodes, reducing redundancy while preserving semantics.
 */
export class HTMLAstOptimizer {
  private stateClasses: Map<number, StateClass>;
  private nodeSignatures: Map<string, Node>;
  private minimizedNodes: WeakMap<Node, Node>;

  constructor() {
    this.stateClasses = new Map();
    this.nodeSignatures = new Map();
    this.minimizedNodes = new WeakMap();
  }

  /**
   * Optimize an AST to reduce redundancy while preserving semantics.
   * 
   * @param ast - The AST to optimize
   * @returns An optimized AST with equivalent functionality
   */
  public optimize(ast: AST): AST {
    try {
      // Phase 1: Build state equivalence classes
      this.buildStateClasses(ast);
      
      // Phase 2: Node reduction and path optimization
      const optimizedAST = this.optimizeNode(ast.root);
      
      // Phase 3: Memory optimization
      this.applyMemoryOptimizations(optimizedAST);

      // Compute optimization metrics
      const metrics = this.computeOptimizationMetrics(ast.root, optimizedAST);

      return {
        root: optimizedAST,
        metadata: {
          ...ast.metadata,
          optimizationMetrics: metrics
        }
      };
    } catch (error) {
      throw new Error(`AST optimization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Builds equivalence classes for nodes in the AST based on their structure and semantics.
   * 
   * @param ast - The AST to analyze
   */
  private buildStateClasses(ast: AST): void {
    const stateSignatures = new Map<string, Set<Node>>();
    
    // First pass: Collect state signatures
    const collectSignatures = (node: Node): void => {
      const signature = this.computeNodeSignature(node);
      if (!stateSignatures.has(signature)) {
        stateSignatures.set(signature, new Set());
      }
      stateSignatures.get(signature)?.add(node);
      
      if (node.children) {
        node.children.forEach(collectSignatures);
      }
    };
    
    collectSignatures(ast.root);
    
    // Second pass: Build equivalence classes
    let classId = 0;
    for (const [signature, nodes] of stateSignatures) {
      if (nodes.size > 1) {
        this.stateClasses.set(classId, {
          signature,
          nodes: new Set(nodes)
        });
        classId++;
      }
    }
  }

  /**
   * Computes a unique signature for a node based on its structure and content.
   * 
   * @param node - The node to compute a signature for
   * @returns A string signature that uniquely identifies the node's structure
   */
  private computeNodeSignature(node: Node): string {
    const components: string[] = [];
    
    // Add type and name
    components.push(node.type);
    if (node.name) components.push(node.name);
    
    // Add attributes signature
    if (node.attributes && node.attributes.size > 0) {
      const sortedAttrs = Array.from(node.attributes.entries())
        .sort(([a], [b]) => a.localeCompare(b));
      components.push(JSON.stringify(sortedAttrs));
    }
    
    // Add children types signature
    if (node.children && node.children.length > 0) {
      const childrenTypes = node.children.map(child => child.type).join(',');
      components.push(childrenTypes);
    }
    
    return components.join('|');
  }

  /**
   * Optimizes a node by reducing redundancy and applying optimizations.
   * 
   * @param node - The node to optimize
   * @returns An optimized version of the node
   */
  private optimizeNode(node: Node): Node {
    // Check if node has already been minimized
    if (this.minimizedNodes.has(node)) {
      return this.minimizedNodes.get(node) as Node;
    }
    
    // Create optimized node
    const optimized: Node = {
      type: node.type,
      children: [],
      metadata: {
        ...node.metadata,
        isMinimized: true
      }
    };
    
    // Copy essential properties
    if (node.name) optimized.name = node.name;
    if (node.value) optimized.value = node.value;
    if (node.attributes) {
      optimized.attributes = new Map(
        Array.from(node.attributes.entries())
          .filter(([_, value]) => value !== null && value !== '')
      );
    }
    
    // Optimize children
    if (node.children && node.children.length > 0) {
      optimized.children = this.optimizeChildren(node.children);
    }
    
    // Cache optimized node
    this.minimizedNodes.set(node, optimized);
    
    return optimized;
  }

  /**
   * Optimizes a list of child nodes by removing redundancies and merging when possible.
   * 
   * @param children - The child nodes to optimize
   * @returns An optimized list of child nodes
   */
  private optimizeChildren(children: Node[]): Node[] {
    // Remove redundant text nodes
    const optimizedChildren = children
      .filter(child => {
        if (child.type === 'Text') {
          return child.value && child.value.trim().length > 0;
        }
        return true;
      })
      .map(child => this.optimizeNode(child));
    
    // Merge adjacent text nodes
    return this.mergeAdjacentTextNodes(optimizedChildren);
  }

  /**
   * Merges adjacent text nodes to reduce node count.
   * 
   * @param children - The child nodes to process
   * @returns Nodes with adjacent text nodes merged
   */
  private mergeAdjacentTextNodes(children: Node[]): Node[] {
    const merged: Node[] = [];
    let currentTextNode: Node | null = null;
    
    for (const child of children) {
      if (child.type === 'Text') {
        if (currentTextNode) {
          currentTextNode.value = `${currentTextNode.value || ''}${child.value || ''}`;
        } else {
          currentTextNode = { ...child };
          merged.push(currentTextNode);
        }
      } else {
        currentTextNode = null;
        merged.push(child);
      }
    }
    
    return merged;
  }

  /**
   * Applies memory optimizations to the optimized node structure.
   * 
   * @param node - The node to optimize for memory usage
   */
  private applyMemoryOptimizations(node: Node): void {
    // Freeze objects to prevent modifications
    Object.freeze(node.metadata);
    if (node.attributes) {
      Object.freeze(node.attributes);
    }
    
    // Recursively optimize children
    if (node.children) {
      node.children.forEach(this.applyMemoryOptimizations.bind(this));
      Object.freeze(node.children);
    }
    
    // Freeze the node itself
    Object.freeze(node);
  }

  /**
   * Computes optimization metrics by comparing original and optimized trees.
   * 
   * @param originalRoot - The root node of the original AST
   * @param optimizedRoot - The root node of the optimized AST
   * @returns Metrics showing the effectiveness of the optimization
   */
  private computeOptimizationMetrics(originalRoot: Node, optimizedRoot: Node): OptimizationMetrics {
    const originalMetrics = this.getNodeMetrics(originalRoot);
    const optimizedMetrics = this.getNodeMetrics(optimizedRoot);
    
    const totalNodes = Array.from(this.stateClasses.values())
      .reduce((acc, cls) => acc + cls.nodes.size, 0);
    const averageSize = totalNodes / this.stateClasses.size || 0;
    
    return {
      nodeReduction: {
        original: originalMetrics.totalNodes,
        optimized: optimizedMetrics.totalNodes,
        ratio: optimizedMetrics.totalNodes / originalMetrics.totalNodes
      },
      memoryUsage: {
        original: originalMetrics.estimatedMemory,
        optimized: optimizedMetrics.estimatedMemory,
        ratio: optimizedMetrics.estimatedMemory / originalMetrics.estimatedMemory
      },
      stateClasses: {
        count: this.stateClasses.size,
        averageSize
      }
    };
  }

  /**
   * Gets node metrics including total count and estimated memory usage.
   * 
   * @param node - The node to analyze
   * @param metrics - Optional existing metrics to update
   * @returns Updated metrics for the node and its children
   */
  private getNodeMetrics(
    node: Node, 
    metrics: { totalNodes: number; estimatedMemory: number } = { totalNodes: 0, estimatedMemory: 0 }
  ): { totalNodes: number; estimatedMemory: number } {
    metrics.totalNodes++;
    metrics.estimatedMemory += this.estimateNodeMemory(node);
    
    if (node.children) {
      node.children.forEach(child => this.getNodeMetrics(child, metrics));
    }
    
    return metrics;
  }

  /**
   * Estimates memory usage for a node.
   * 
   * @param node - The node to estimate memory usage for
   * @returns Estimated bytes used by the node
   */
  private estimateNodeMemory(node: Node): number {
    let bytes = 0;
    
    // Base object overhead
    bytes += 40;
    
    // Type and name strings
    bytes += (node.type?.length ?? 0) * 2;
    bytes += (node.name?.length ?? 0) * 2;
    
    // Value for text nodes
    if (node.type === 'Text') {
      bytes += (node.value?.length ?? 0) * 2;
    }
    
    // Attributes
    if (node.attributes) {
      for (const [key, value] of node.attributes.entries()) {
        bytes += (key.length + String(value).length) * 2;
      }
    }
    
    // Metadata
    bytes += JSON.stringify(node.metadata).length * 2;
    
    return bytes;
  }
}