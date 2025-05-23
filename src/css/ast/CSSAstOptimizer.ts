import { CSSAST } from './CSSAST';
import { CSSNode } from './CSSNode';

/**
 * Optimization options
 */
export interface OptimizationOptions {
  mergeAdjacentValues?: boolean;
  removeEmptyNodes?: boolean;
  removeComments?: boolean;
  optimizeAttributes?: boolean;
  level?: 'minimal' | 'standard' | 'aggressive';
}

/**
 * Optimization metrics
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
 * CSS AST Optimizer
 * Implements state machine minimization techniques for CSS ASTs
 */
export class CSSAstOptimizer {
  /**
   * State equivalence classes
   */
  private stateClasses: Map<number, { signature: string; nodes: Set<CSSNode> }>;
  
  /**
   * Node signatures map
   */
  private nodeSignatures: Map<string, number>;
  
  /**
   * Minimized nodes cache
   */
  private minimizedNodes: WeakMap<CSSNode, CSSNode>;
  
  /**
   * Creates a new AST optimizer
   */
  constructor() {
    this.stateClasses = new Map();
    this.nodeSignatures = new Map();
    this.minimizedNodes = new WeakMap();
  }
  
  /**
   * Optimizes a CSS AST using state minimization techniques
   * 
   * @param ast - The AST to optimize
   * @param options - Optimization options
   * @returns The optimized AST
   */
  public optimize(ast: CSSAST, options: OptimizationOptions = {}): CSSAST {
    // Default options
    const opts = {
      mergeAdjacentValues: true,
      removeEmptyNodes: true,
      removeComments: true,
      optimizeAttributes: true,
      level: 'standard',
      ...options
    };
    
    // Phase 1: Build state equivalence classes
    this.buildStateClasses(ast.root);
    
    // Phase 2: Node reduction and path optimization
    const optimizedRoot = this.optimizeNode(ast.root, opts);
    
    // Phase 3: Memory optimization
    this.applyMemoryOptimizations(optimizedRoot);
    
    // Compute optimization metrics
    const metrics = this.computeOptimizationMetrics(ast.root, optimizedRoot);
    
    // Create optimized AST
    return new CSSAST(optimizedRoot, {
      ...ast.metadata,
      optimizationMetrics: {
        originalNodeCount: metrics.nodeReduction.original,
        minimizedNodeCount: metrics.nodeReduction.optimized,
        optimizationRatio: metrics.nodeReduction.ratio
      }
    });
  }
  
  /**
   * Builds state equivalence classes
   * 
   * @param root - The root node
   */
  /**
   * Builds state equivalence classes for nodes in the AST
   * This is the first phase of the optimization process
   * 
   * @param root - The root node of the AST
   */
  private buildStateClasses(root: CSSNode): void {
    const stateSignatures = new Map<string, Set<CSSNode>>();
    
    // First pass: Collect state signatures
    const collectSignatures = (node: CSSNode): void => {
      const signature = this.computeNodeSignature(node);
      
      if (!stateSignatures.has(signature)) {
        stateSignatures.set(signature, new Set());
      }
      
      stateSignatures.get(signature)!.add(node);
      
      for (const child of node.children) {
        collectSignatures(child);
      }
    };
    
    collectSignatures(root);
    
    // Second pass: Build equivalence classes
    let classId = 0;
    for (const [signature, nodes] of stateSignatures) {
      if (nodes.size > 1) {
        this.stateClasses.set(classId, {
          signature,
          nodes: new Set(nodes)
        });
        
        // Store signature to class ID mapping
        this.nodeSignatures.set(signature, classId);
        
        // Update nodes with their equivalence class
        for (const node of nodes) {
          node.metadata.equivalenceClass = classId;
        }
        
        classId++;
      }
    }
  }
  
  /**
   * Computes a signature for a node based on its type, value, and children
   * This signature is used to identify equivalent nodes
   * 
   * @param node - The node to compute a signature for
   * @returns The node signature
   */
  private computeNodeSignature(node: CSSNode): string {
    const components = [];
    
    // Add type and value
    components.push(node.type);
    if (node.value !== null) components.push(node.value);
    
    // Add children types signature
    if (node.children.length > 0) {
      const childrenTypes = node.children.map(c => c.type).join(',');
      components.push(childrenTypes);
    }
    
    return components.join('|');
  }
  
  /**
   * Optimizes a node and its children
   * This is the second phase of the optimization process
   * 
   * @param node - The node to optimize
   * @param options - Optimization options
   * @returns The optimized node
   */
  private optimizeNode(node: CSSNode, options: OptimizationOptions): CSSNode {
    // Check if node has already been minimized
    if (this.minimizedNodes.has(node)) {
      return this.minimizedNodes.get(node)!;
    }
    
    // Create optimized node
    const optimized = new CSSNode(node.type, node.value);
    optimized.metadata = { ...node.metadata, isMinimized: true };
    
    // Optimize children if needed
    if (node.children.length > 0) {
      optimized.children = this.optimizeChildren(node.children, options);
      optimized.children.forEach(child => child.parent = optimized);
    }
    
    // Cache optimized node
    this.minimizedNodes.set(node, optimized);
    
    return optimized;
  }
  
  /**
   * Optimizes an array of child nodes
   * Applies various optimizations based on the options
   * 
   * @param children - The children to optimize
   * @param options - Optimization options
   * @returns The optimized children
   */
  private optimizeChildren(children: CSSNode[], options: OptimizationOptions): CSSNode[] {
    // Apply filters based on options
    let optimizedChildren = children;
    
    // Remove empty nodes if requested
    if (options.removeEmptyNodes) {
      optimizedChildren = optimizedChildren.filter(child => {
        if (child.type === 'value') {
          return child.value !== null && child.value.trim().length > 0;
        }
        return true;
      });
    }
    
    // Remove comments if requested
    if (options.removeComments) {
      optimizedChildren = optimizedChildren.filter(child => 
        child.type !== 'comment'
      );
    }
    
    // Merge adjacent values if requested
    if (options.mergeAdjacentValues) {
      optimizedChildren = this.mergeAdjacentValues(optimizedChildren);
    }
    
    // Recursively optimize children
    optimizedChildren = optimizedChildren.map(child => 
      this.optimizeNode(child, options)
    );
    
    return optimizedChildren;
  }
  
  /**
   * Merges adjacent value nodes
   * This helps reduce the number of nodes in the AST
   * 
   * @param children - The children to merge
   * @returns The merged children
   */
  private mergeAdjacentValues(children: CSSNode[]): CSSNode[] {
    const merged: CSSNode[] = [];
    let currentValue: CSSNode | null = null;
    
    for (const child of children) {
      if (child.type === 'value') {
        if (currentValue) {
          // Merge with previous value
          currentValue.value += ' ' + child.value;
        } else {
          // Start a new value
          currentValue = child;
          merged.push(currentValue);
        }
      } else {
        // Reset current value
        currentValue = null;
        merged.push(child);
      }
    }
    
    return merged;
  }
  
  /**
   * Applies memory optimizations to a node tree
   * This is the third phase of the optimization process
   * 
   * @param node - The node to optimize
   */
  private applyMemoryOptimizations(node: CSSNode): void {
    // Freeze metadata to prevent modifications
    Object.freeze(node.metadata);
    
    // Recursively optimize children
    for (const child of node.children) {
      this.applyMemoryOptimizations(child);
    }
    
    // Freeze children array
    Object.freeze(node.children);
    
    // Freeze the node itself to prevent modifications
    Object.freeze(node);
  }
  
  /**
   * Computes optimization metrics by comparing original and optimized ASTs
   * 
   * @param originalRoot - The original root node
   * @param optimizedRoot - The optimized root node
   * @returns Optimization metrics
   */
  private computeOptimizationMetrics(originalRoot: CSSNode, optimizedRoot: CSSNode): OptimizationMetrics {
    const originalMetrics = this.getNodeMetrics(originalRoot);
    const optimizedMetrics = this.getNodeMetrics(optimizedRoot);
    
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
        averageSize: this.stateClasses.size > 0 
          ? Array.from(this.stateClasses.values())
              .reduce((acc, cls) => acc + cls.nodes.size, 0) / this.stateClasses.size
          : 0
      }
    };
  }
  
  /**
   * Collects metrics about a node and its children
   * 
   * @param node - The node to analyze
   * @param metrics - The metrics object to update
   * @returns The updated metrics
   */
  private getNodeMetrics(node: CSSNode, metrics: { totalNodes: number; estimatedMemory: number } = { totalNodes: 0, estimatedMemory: 0 }): { totalNodes: number; estimatedMemory: number } {
    // Count the node
    metrics.totalNodes++;
    
    // Estimate memory usage
    metrics.estimatedMemory += this.estimateNodeMemory(node);
    
    // Recursively process children
    for (const child of node.children) {
      this.getNodeMetrics(child, metrics);
    }
    
    return metrics;
  }
  
  /**
   * Estimates the memory usage of a node in bytes
   * 
   * @param node - The node to analyze
   * @returns Estimated memory usage in bytes
   */
  private estimateNodeMemory(node: CSSNode): number {
    let bytes = 0;
    
    // Base object overhead
    bytes += 40;
    
    // Type string
    bytes += (node.type?.length ?? 0) * 2;
    
    // Value string
    bytes += (node.value?.length ?? 0) * 2;
    
    // Metadata
    bytes += JSON.stringify(node.metadata).length * 2;
    
    return bytes;
  }
}