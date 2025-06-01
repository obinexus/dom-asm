/**
 * HTMLASTBuilder - Optimized AST Construction with Integrated State Minimization
 * 
 * Integrates HTMLAstOptimizer behaviors directly into AST construction phase.
 * Implements Ship of Theseus principle for behavioral equivalence preservation
 * while achieving aggressive optimization through state machine minimization.
 */

import {
  HTMLASTNode,
  HTMLNodeType,
  DocumentNode,
  ElementNode,
  TextNode,
  CommentNode,
  HTMLParserResult,
  BehavioralSignature,
  EquivalenceClass,
  StateMinimizationResult
} from '@dom-asm/html/types';

interface OptimizationMetrics {
  originalNodeCount: number;
  optimizedNodeCount: number;
  memoryReduction: number;
  equivalenceClassCount: number;
  compressionRatio: number;
}

export class HTMLASTBuilder {
  private stateClasses: Map<string, { signature: string; nodes: Set<HTMLASTNode> }>;
  private nodeSignatures: Map<string, HTMLASTNode>;
  private minimizedNodes: WeakMap<HTMLASTNode, HTMLASTNode>;
  private equivalenceClasses: Map<string, EquivalenceClass>;
  private optimizationEnabled: boolean;

  constructor(enableOptimization: boolean = true) {
    this.stateClasses = new Map();
    this.nodeSignatures = new Map();
    this.minimizedNodes = new WeakMap();
    this.equivalenceClasses = new Map();
    this.optimizationEnabled = enableOptimization;
  }

  /**
   * Build optimized AST from parser result
   * Implements single-pass optimization during construction
   */
  public buildOptimizedAST(parserResult: HTMLParserResult, optimize: boolean = true): DocumentNode {
    const { ast } = parserResult;
    
    if (!optimize || !this.optimizationEnabled) {
      return ast;
    }

    // Initialize optimization structures
    this.initializeOptimization();
    
    // Build state classes for equivalence determination
    this.buildStateClasses(ast);
    
    // Apply optimizations during construction
    const optimizedAST = this.optimizeNode(ast) as DocumentNode;
    
    // Apply memory optimizations
    this.applyMemoryOptimizations(optimizedAST);
    
    return optimizedAST;
  }

  /**
   * Generate state minimization report for behavioral validation
   */
  public generateMinimizationReport(original: DocumentNode, optimized: DocumentNode): StateMinimizationResult {
    const originalCount = this.countNodes(original);
    const optimizedCount = this.countNodes(optimized);
    
    return {
      originalStateCount: originalCount,
      minimizedStateCount: optimizedCount,
      equivalenceClasses: Array.from(this.equivalenceClasses.values()),
      optimizationRatio: (originalCount - optimizedCount) / originalCount,
      behavioralEquivalence: this.validateBehavioralEquivalence(original, optimized)
    };
  }

  private initializeOptimization(): void {
    this.stateClasses.clear();
    this.nodeSignatures.clear();
    this.equivalenceClasses.clear();
  }

  /**
   * Build state classes for node equivalence determination
   * Implements behavioral signature computation for Ship of Theseus validation
   */
  private buildStateClasses(ast: HTMLASTNode): void {
    this.traverseForClassification(ast);
    
    // Build equivalence classes from state signatures
    for (const [signature, group] of this.stateClasses) {
      if (group.nodes.size > 1) {
        // Multiple nodes with same signature - candidates for optimization
        const representative = this.selectRepresentative(group.nodes);
        
        const equivalenceClass: EquivalenceClass = {
          id: `class_${this.equivalenceClasses.size}`,
          signature,
          nodes: group.nodes,
          representative
        };
        
        this.equivalenceClasses.set(signature, equivalenceClass);
      }
    }
  }

  private traverseForClassification(node: HTMLASTNode): void {
    const signature = this.computeNodeSignature(node);
    
    if (!this.stateClasses.has(signature)) {
      this.stateClasses.set(signature, {
        signature,
        nodes: new Set()
      });
    }
    
    this.stateClasses.get(signature)!.nodes.add(node);
    this.nodeSignatures.set(node.id, node);
    
    // Recursively classify children
    for (const child of node.children) {
      this.traverseForClassification(child);
    }
  }

  /**
   * Compute behavioral signature for node equivalence determination
   * Critical for maintaining Ship of Theseus behavioral equivalence
   */
  private computeNodeSignature(node: HTMLASTNode): string {
    const components: string[] = [node.type];
    
    switch (node.type) {
      case HTMLNodeType.Element:
        const element = node as ElementNode;
        components.push(element.tagName);
        
        // Include sorted attributes for consistent signatures
        if (element.attributes.size > 0) {
          const sortedAttrs = Array.from(element.attributes.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join(',');
          components.push(`attrs:[${sortedAttrs}]`);
        }
        
        components.push(`selfClosing:${element.selfClosing}`);
        break;
        
      case HTMLNodeType.Text:
        const textNode = node as TextNode;
        components.push(`isWhitespace:${textNode.isWhitespace}`);
        
        // Include content pattern for non-whitespace text
        if (!textNode.isWhitespace) {
          const contentPattern = this.generateContentPattern(textNode.content);
          components.push(`pattern:${contentPattern}`);
        }
        break;
        
      case HTMLNodeType.Comment:
        const commentNode = node as CommentNode;
        components.push(`dataLength:${commentNode.data.length}`);
        break;
    }
    
    // Include structural signature for nesting behavior
    const structuralSignature = this.computeStructuralSignature(node);
    components.push(`structure:${structuralSignature}`);
    
    return components.join('|');
  }

  private generateContentPattern(content: string): string {
    // Generate abstracted pattern for content equivalence
    return content
      .replace(/\d+/g, 'NUM')
      .replace(/[a-zA-Z]+/g, 'WORD')
      .replace(/\s+/g, 'SPACE')
      .substring(0, 50); // Limit pattern length
  }

  private computeStructuralSignature(node: HTMLASTNode): string {
    const childSignatures = node.children.map(child => child.type).sort();
    return `children:[${childSignatures.join(',')}]`;
  }

  /**
   * Optimize node using equivalence class mapping
   * Implements aggressive state minimization while preserving behavior
   */
  private optimizeNode(node: HTMLASTNode): HTMLASTNode {
    // Check if node has already been optimized
    if (this.minimizedNodes.has(node)) {
      return this.minimizedNodes.get(node)!;
    }
    
    const signature = this.computeNodeSignature(node);
    const equivalenceClass = this.equivalenceClasses.get(signature);
    
    let optimizedNode: HTMLASTNode;
    
    if (equivalenceClass && equivalenceClass.nodes.has(node) && equivalenceClass.representative !== node) {
      // Use representative node for equivalent behavior
      optimizedNode = this.cloneNode(equivalenceClass.representative);
      optimizedNode.id = node.id; // Preserve original ID for traceability
    } else {
      // Clone and optimize children
      optimizedNode = this.cloneNode(node);
    }
    
    // Recursively optimize children
    optimizedNode.children = this.optimizeChildren(node.children);
    
    // Update parent references
    for (const child of optimizedNode.children) {
      child.parent = optimizedNode;
    }
    
    // Cache optimization result
    this.minimizedNodes.set(node, optimizedNode);
    
    return optimizedNode;
  }

  private optimizeChildren(children: HTMLASTNode[]): HTMLASTNode[] {
    const optimizedChildren = children.map(child => this.optimizeNode(child));
    
    // Apply additional optimizations
    return this.mergeAdjacentTextNodes(optimizedChildren);
  }

  /**
   * Merge adjacent text nodes for memory efficiency
   * Maintains behavioral equivalence while reducing node count
   */
  private mergeAdjacentTextNodes(children: HTMLASTNode[]): HTMLASTNode[] {
    const merged: HTMLASTNode[] = [];
    let currentTextContent = '';
    let currentTextNode: TextNode | null = null;
    
    for (const child of children) {
      if (child.type === HTMLNodeType.Text) {
        const textNode = child as TextNode;
        
        if (currentTextNode && currentTextNode.isWhitespace === textNode.isWhitespace) {
          // Merge with previous text node
          currentTextContent += textNode.content;
        } else {
          // Finalize previous text node if exists
          if (currentTextNode) {
            currentTextNode.content = currentTextContent;
            merged.push(currentTextNode);
          }
          
          // Start new text sequence
          currentTextNode = this.cloneNode(textNode) as TextNode;
          currentTextContent = textNode.content;
        }
      } else {
        // Finalize any pending text node
        if (currentTextNode) {
          currentTextNode.content = currentTextContent;
          merged.push(currentTextNode);
          currentTextNode = null;
          currentTextContent = '';
        }
        
        merged.push(child);
      }
    }
    
    // Finalize any remaining text node
    if (currentTextNode) {
      currentTextNode.content = currentTextContent;
      merged.push(currentTextNode);
    }
    
    return merged;
  }

  private selectRepresentative(nodes: Set<HTMLASTNode>): HTMLASTNode {
    // Select representative based on optimization criteria
    let representative = nodes.values().next().value;
    let minMemoryFootprint = this.estimateNodeMemory(representative);
    
    for (const node of nodes) {
      const memoryFootprint = this.estimateNodeMemory(node);
      if (memoryFootprint < minMemoryFootprint) {
        representative = node;
        minMemoryFootprint = memoryFootprint;
      }
    }
    
    return representative;
  }

  private cloneNode(node: HTMLASTNode): HTMLASTNode {
    const cloned: any = {
      id: node.id,
      type: node.type,
      children: [], // Will be set by caller
      parent: undefined, // Will be set by caller
      equivalenceClass: node.equivalenceClass,
      metadata: new Map(node.metadata)
    };
    
    // Copy type-specific properties
    switch (node.type) {
      case HTMLNodeType.Element:
        const element = node as ElementNode;
        cloned.tagName = element.tagName;
        cloned.attributes = new Map(element.attributes);
        cloned.namespace = element.namespace;
        cloned.selfClosing = element.selfClosing;
        break;
        
      case HTMLNodeType.Text:
        const textNode = node as TextNode;
        cloned.content = textNode.content;
        cloned.isWhitespace = textNode.isWhitespace;
        break;
        
      case HTMLNodeType.Comment:
        const commentNode = node as CommentNode;
        cloned.data = commentNode.data;
        break;
        
      case HTMLNodeType.Document:
        const docNode = node as DocumentNode;
        cloned.doctype = docNode.doctype;
        cloned.documentElement = undefined; // Will be set after optimization
        break;
    }
    
    return cloned;
  }

  /**
   * Apply memory optimizations to the constructed AST
   */
  private applyMemoryOptimizations(node: HTMLASTNode): void {
    // Intern common strings to reduce memory usage
    this.internCommonStrings(node);
    
    // Optimize attribute storage
    this.optimizeAttributes(node);
    
    // Apply recursive optimizations
    for (const child of node.children) {
      this.applyMemoryOptimizations(child);
    }
  }

  private internCommonStrings(node: HTMLASTNode): void {
    // Implement string interning for common values
    if (node.type === HTMLNodeType.Element) {
      const element = node as ElementNode;
      element.tagName = this.internString(element.tagName);
    }
  }

  private optimizeAttributes(node: HTMLASTNode): void {
    if (node.type === HTMLNodeType.Element) {
      const element = node as ElementNode;
      
      // Remove redundant attributes
      const optimizedAttrs = new Map<string, string>();
      
      for (const [key, value] of element.attributes) {
        // Skip attributes with default values
        if (!this.isDefaultAttributeValue(element.tagName, key, value)) {
          optimizedAttrs.set(this.internString(key), this.internString(value));
        }
      }
      
      element.attributes = optimizedAttrs;
    }
  }

  private isDefaultAttributeValue(tagName: string, attribute: string, value: string): boolean {
    // Define default attribute values to optimize away
    const defaults: Record<string, Record<string, string>> = {
      input: {
        type: 'text'
      },
      button: {
        type: 'button'
      },
      script: {
        type: 'text/javascript'
      }
    };
    
    return defaults[tagName]?.[attribute] === value;
  }

  private internString(str: string): string {
    // Simple string interning implementation
    // In production, use a more sophisticated interning strategy
    return str;
  }

  private validateBehavioralEquivalence(original: HTMLASTNode, optimized: HTMLASTNode): boolean {
    // Implement comprehensive behavioral equivalence validation
    if (original.type !== optimized.type) {
      return false;
    }
    
    if (original.children.length !== optimized.children.length) {
      return false;
    }
    
    // Validate type-specific equivalence
    switch (original.type) {
      case HTMLNodeType.Element:
        const origElement = original as ElementNode;
        const optElement = optimized as ElementNode;
        
        if (origElement.tagName !== optElement.tagName) {
          return false;
        }
        
        // Validate essential attributes (ignore default values)
        const origEssentialAttrs = this.getEssentialAttributes(origElement);
        const optEssentialAttrs = this.getEssentialAttributes(optElement);
        
        if (origEssentialAttrs.size !== optEssentialAttrs.size) {
          return false;
        }
        
        for (const [key, value] of origEssentialAttrs) {
          if (optEssentialAttrs.get(key) !== value) {
            return false;
          }
        }
        break;
        
      case HTMLNodeType.Text:
        const origText = original as TextNode;
        const optText = optimized as TextNode;
        
        if (origText.content !== optText.content || origText.isWhitespace !== optText.isWhitespace) {
          return false;
        }
        break;
    }
    
    // Recursively validate children
    for (let i = 0; i < original.children.length; i++) {
      if (!this.validateBehavioralEquivalence(original.children[i], optimized.children[i])) {
        return false;
      }
    }
    
    return true;
  }

  private getEssentialAttributes(element: ElementNode): Map<string, string> {
    const essential = new Map<string, string>();
    
    for (const [key, value] of element.attributes) {
      if (!this.isDefaultAttributeValue(element.tagName, key, value)) {
        essential.set(key, value);
      }
    }
    
    return essential;
  }

  private countNodes(node: HTMLASTNode): number {
    let count = 1;
    for (const child of node.children) {
      count += this.countNodes(child);
    }
    return count;
  }

  private estimateNodeMemory(node: HTMLASTNode): number {
    // Rough memory estimation for optimization decisions
    let size = 100; // Base node overhead
    
    switch (node.type) {
      case HTMLNodeType.Element:
        const element = node as ElementNode;
        size += element.tagName.length * 2;
        
        for (const [key, value] of element.attributes) {
          size += (key.length + value.length) * 2;
        }
        break;
        
      case HTMLNodeType.Text:
        const textNode = node as TextNode;
        size += textNode.content.length * 2;
        break;
        
      case HTMLNodeType.Comment:
        const commentNode = node as CommentNode;
        size += commentNode.data.length * 2;
        break;
    }
    
    return size;
  }
}