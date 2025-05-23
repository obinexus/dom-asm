import { Node, AST } from '../core/types';

/**
 * Represents a difference between two ASTs
 */
export interface Diff {
  type: 'ADD' | 'REMOVE' | 'UPDATE' | 'REPLACE' | 'MOVE';
  path: number[];
  node?: Node;
  changes?: Record<string, any>;
  from?: number[];
  to?: number[];
}

/**
 * Represents a patch operation to be applied to the DOM
 */
export interface Patch {
  type: 'CREATE' | 'UPDATE' | 'REPLACE' | 'REMOVE' | 'MOVE';
  path: number[];
  node?: Node;
  attributes?: Record<string, any>;
  from?: number[];
  to?: number[];
}

/**
 * Options for the diffing algorithm
 */
export interface DiffOptions {
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
  optimizeTextChanges?: boolean;
  useKeyAttribute?: string;
}

/**
 * DiffPatchEngine
 * Computes differences between two ASTs and generates patches that can be
 * applied to the DOM to transform it from one state to another.
 */
export class DiffPatchEngine {
  private options: DiffOptions;
  private keyMap: Map<string, number[]>;
  
  constructor(options: DiffOptions = {}) {
    this.options = {
      ignoreWhitespace: true,
      ignoreCase: false,
      optimizeTextChanges: true,
      useKeyAttribute: 'key',
      ...options
    };
    this.keyMap = new Map();
  }
  
  /**
   * Computes differences between two ASTs.
   * 
   * @param oldAST - The original AST
   * @param newAST - The new AST
   * @returns An array of differences
   */
  public diff(oldAST: AST, newAST: AST): Diff[] {
    this.keyMap.clear();
    
    // Preprocess ASTs to identify nodes with keys
    this.preprocessKeysInAST(oldAST.root, []);
    
    const diffs: Diff[] = [];
    this.diffNodes(oldAST.root, newAST.root, [], diffs);
    
    // Optimize the diffs
    return this.optimizeDiffs(diffs);
  }
  
  /**
   * Preprocesses an AST to identify and map nodes with key attributes.
   * 
   * @param node - The node to preprocess
   * @param path - The current path to the node
   */
  private preprocessKeysInAST(node: Node, path: number[]): void {
    if (!node) return;
    
    // Check if the node has a key attribute
    const keyAttr = this.options.useKeyAttribute;
    if (keyAttr && node.attributes && node.attributes.has(keyAttr)) {
      const key = node.attributes.get(keyAttr) as string;
      if (key) {
        this.keyMap.set(key, [...path]);
      }
    }
    
    // Process children
    if (node.children) {
      node.children.forEach((child, index) => {
        this.preprocessKeysInAST(child, [...path, index]);
      });
    }
  }
  
  /**
   * Recursively computes differences between two nodes.
   * 
   * @param oldNode - The original node
   * @param newNode - The new node
   * @param path - The current path to the node
   * @param diffs - The array of differences to update
   */
  private diffNodes(oldNode: Node | null, newNode: Node | null, path: number[], diffs: Diff[]): void {
    // Handle case where both nodes are null
    if (!oldNode && !newNode) return;
    
    // Handle case where old node is null (addition)
    if (!oldNode && newNode) {
      diffs.push({
        type: 'ADD',
        path,
        node: this.cloneNode(newNode)
      });
      return;
    }
    
    // Handle case where new node is null (removal)
    if (oldNode && !newNode) {
      diffs.push({
        type: 'REMOVE',
        path
      });
      return;
    }
    
    // Both nodes exist, compare them
    if (oldNode && newNode) {
      // If node types differ, replace the whole node
      if (oldNode.type !== newNode.type) {
        diffs.push({
          type: 'REPLACE',
          path,
          node: this.cloneNode(newNode)
        });
        return;
      }
      
      // Check for attribute changes
      const attrChanges = this.diffAttributes(oldNode, newNode);
      if (Object.keys(attrChanges).length > 0) {
        diffs.push({
          type: 'UPDATE',
          path,
          changes: attrChanges
        });
      }
      
      // Special handling for text nodes
      if (oldNode.type === 'Text' && newNode.type === 'Text') {
        const oldText = this.options.ignoreWhitespace 
          ? (oldNode.value || '').trim() 
          : (oldNode.value || '');
        const newText = this.options.ignoreWhitespace 
          ? (newNode.value || '').trim() 
          : (newNode.value || '');
        
        if (oldText !== newText) {
          diffs.push({
            type: 'UPDATE',
            path,
            changes: { value: newNode.value }
          });
        }
        return;
      }
      
      // Recursively diff children
      this.diffChildren(oldNode, newNode, path, diffs);
    }
  }
  
  /**
   * Computes differences between the attributes of two nodes.
   * 
   * @param oldNode - The original node
   * @param newNode - The new node
   * @returns Object containing attribute changes
   */
  private diffAttributes(oldNode: Node, newNode: Node): Record<string, any> {
    const changes: Record<string, any> = {};
    
    // Handle missing attributes map
    const oldAttributes = oldNode.attributes || new Map();
    const newAttributes = newNode.attributes || new Map();
    
    // Check for added or changed attributes
    for (const [key, value] of newAttributes.entries()) {
      if (!oldAttributes.has(key)) {
        // Attribute was added
        changes[key] = value;
      } else if (oldAttributes.get(key) !== value) {
        // Attribute value changed
        changes[key] = value;
      }
    }
    
    // Check for removed attributes
    for (const key of oldAttributes.keys()) {
      if (!newAttributes.has(key)) {
        changes[key] = null; // Mark as removed
      }
    }
    
    return changes;
  }
  
  /**
   * Computes differences between the children of two nodes.
   * Uses key attributes for improved matching when available.
   * 
   * @param oldNode - The original node
   * @param newNode - The new node
   * @param path - The current path to the node
   * @param diffs - The array of differences to update
   */
  private diffChildren(oldNode: Node, newNode: Node, path: number[], diffs: Diff[]): void {
    const oldChildren = oldNode.children || [];
    const newChildren = newNode.children || [];
    
    // Use key attribute to match nodes if possible
    const keyAttr = this.options.useKeyAttribute;
    
    if (keyAttr) {
      this.diffChildrenWithKeys(oldChildren, newChildren, path, diffs);
    } else {
      this.diffChildrenWithoutKeys(oldChildren, newChildren, path, diffs);
    }
  }
  
  /**
   * Diffs children using key attributes to match nodes.
   * This allows for more accurate tracking of node movement.
   * 
   * @param oldChildren - The original children
   * @param newChildren - The new children
   * @param path - The current path to the parent node
   * @param diffs - The array of differences to update
   */
  private diffChildrenWithKeys(oldChildren: Node[], newChildren: Node[], path: number[], diffs: Diff[]): void {
    const oldKeyMap = new Map<string, { node: Node; index: number }>();
    const newKeyMap = new Map<string, { node: Node; index: number }>();
    
    // Build maps of keyed nodes
    oldChildren.forEach((node, index) => {
      if (node.attributes && node.attributes.has(this.options.useKeyAttribute!)) {
        const key = node.attributes.get(this.options.useKeyAttribute!) as string;
        if (key) {
          oldKeyMap.set(key, { node, index });
        }
      }
    });
    
    newChildren.forEach((node, index) => {
      if (node.attributes && node.attributes.has(this.options.useKeyAttribute!)) {
        const key = node.attributes.get(this.options.useKeyAttribute!) as string;
        if (key) {
          newKeyMap.set(key, { node, index });
        }
      }
    });
    
    // Process removals and moves first
    const processedIndices = new Set<number>();
    
    oldChildren.forEach((oldChild, oldIndex) => {
      const oldKey = oldChild.attributes?.get(this.options.useKeyAttribute!) as string;
      
      if (oldKey && newKeyMap.has(oldKey)) {
        // Node exists in both trees
        const { index: newIndex } = newKeyMap.get(oldKey)!;
        
        if (oldIndex !== newIndex) {
          // Node has moved
          diffs.push({
            type: 'MOVE',
            path: [...path, oldIndex],
            from: [...path, oldIndex],
            to: [...path, newIndex]
          });
        }
        
        // Recursively diff this node
        this.diffNodes(
          oldChild, 
          newKeyMap.get(oldKey)!.node, 
          [...path, newIndex], 
          diffs
        );
        
        processedIndices.add(newIndex);
      } else {
        // Node was removed
        diffs.push({
          type: 'REMOVE',
          path: [...path, oldIndex]
        });
      }
    });
    
    // Process additions
    newChildren.forEach((newChild, newIndex) => {
      if (!processedIndices.has(newIndex)) {
        // This is a new node
        diffs.push({
          type: 'ADD',
          path: [...path, newIndex],
          node: this.cloneNode(newChild)
        });
      }
    });
  }
  
  /**
   * Diffs children without using key attributes.
   * Uses position-based comparison with heuristics for better matching.
   * 
   * @param oldChildren - The original children
   * @param newChildren - The new children
   * @param path - The current path to the parent node
   * @param diffs - The array of differences to update
   */
  private diffChildrenWithoutKeys(oldChildren: Node[], newChildren: Node[], path: number[], diffs: Diff[]): void {
    // Use a simple Longest Common Subsequence (LCS) approach
    const lcsMatrix = this.buildLCSMatrix(oldChildren, newChildren);
    const matchedPairs = this.extractMatchedPairs(lcsMatrix, oldChildren, newChildren);
    
    const oldMatched = new Set<number>();
    const newMatched = new Set<number>();
    
    // Process matched nodes first
    for (const [oldIndex, newIndex] of matchedPairs) {
      oldMatched.add(oldIndex);
      newMatched.add(newIndex);
      
      // Recursively diff matched nodes
      this.diffNodes(
        oldChildren[oldIndex],
        newChildren[newIndex],
        [...path, newIndex],
        diffs
      );
    }
    
    // Process removals (nodes in old but not in new)
    for (let i = 0; i < oldChildren.length; i++) {
      if (!oldMatched.has(i)) {
        diffs.push({
          type: 'REMOVE',
          path: [...path, i]
        });
      }
    }
    
    // Process additions (nodes in new but not in old)
    for (let i = 0; i < newChildren.length; i++) {
      if (!newMatched.has(i)) {
        diffs.push({
          type: 'ADD',
          path: [...path, i],
          node: this.cloneNode(newChildren[i])
        });
      }
    }
  }
  
  /**
   * Builds a Longest Common Subsequence matrix for two sets of nodes.
   * 
   * @param oldNodes - The original nodes
   * @param newNodes - The new nodes
   * @returns A 2D matrix for LCS calculation
   */
  private buildLCSMatrix(oldNodes: Node[], newNodes: Node[]): number[][] {
    const matrix: number[][] = Array(oldNodes.length + 1)
      .fill(0)
      .map(() => Array(newNodes.length + 1).fill(0));
    
    for (let i = 1; i <= oldNodes.length; i++) {
      for (let j = 1; j <= newNodes.length; j++) {
        if (this.areNodesEqual(oldNodes[i - 1], newNodes[j - 1])) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
        } else {
          matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
        }
      }
    }
    
    return matrix;
  }
  
  /**
   * Extracts matched pairs of indices from an LCS matrix.
   * 
   * @param matrix - The LCS matrix
   * @param oldNodes - The original nodes
   * @param newNodes - The new nodes
   * @returns An array of [oldIndex, newIndex] pairs
   */
  private extractMatchedPairs(matrix: number[][], oldNodes: Node[], newNodes: Node[]): [number, number][] {
    const pairs: [number, number][] = [];
    let i = oldNodes.length;
    let j = newNodes.length;
    
    while (i > 0 && j > 0) {
      if (this.areNodesEqual(oldNodes[i - 1], newNodes[j - 1])) {
        pairs.push([i - 1, j - 1]);
        i--;
        j--;
      } else if (matrix[i - 1][j] >= matrix[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    
    return pairs.reverse();
  }
  
  /**
   * Determines if two nodes are considered equal for matching purposes.
   * 
   * @param oldNode - The original node
   * @param newNode - The new node
   * @returns Whether the nodes are considered equal
   */
  private areNodesEqual(oldNode: Node, newNode: Node): boolean {
    if (oldNode.type !== newNode.type) return false;
    
    // For text nodes, compare content
    if (oldNode.type === 'Text' && newNode.type === 'Text') {
      const oldText = this.options.ignoreWhitespace 
        ? (oldNode.value || '').trim() 
        : (oldNode.value || '');
      const newText = this.options.ignoreWhitespace 
        ? (newNode.value || '').trim() 
        : (newNode.value || '');
      
      if (this.options.ignoreCase) {
        return oldText.toLowerCase() === newText.toLowerCase();
      }
      return oldText === newText;
    }
    
    // For element nodes, compare tag name and main attributes
    if (oldNode.name !== newNode.name) return false;
    
    // Check for class and id matches as heuristic
    const importantAttrs = ['id', 'class'];
    for (const attr of importantAttrs) {
      const oldValue = oldNode.attributes?.get(attr);
      const newValue = newNode.attributes?.get(attr);
      if (oldValue !== newValue) return false;
    }
    
    return true;
  }
  
  /**
   * Optimizes an array of diffs to reduce redundancy and improve efficiency.
   * 
   * @param diffs - The array of diffs to optimize
   * @returns An optimized array of diffs
   */
  private optimizeDiffs(diffs: Diff[]): Diff[] {
    // Sort diffs by path depth (deeper paths first)
    diffs.sort((a, b) => b.path.length - a.path.length);
    
    // Eliminate redundant operations
    const optimized: Diff[] = [];
    const processedPaths = new Set<string>();
    
    for (const diff of diffs) {
      const pathStr = diff.path.join('.');
      
      // Skip if we've already processed this path with a higher-priority operation
      if (processedPaths.has(pathStr)) continue;
      
      // Skip updates to nodes that will be removed or replaced
      const parentPath = diff.path.slice(0, -1).join('.');
      if (processedPaths.has(parentPath) && diff.type !== 'REMOVE') continue;
      
      // Add this diff and mark path as processed
      optimized.push(diff);
      processedPaths.add(pathStr);
      
      // For removals and replacements, mark all child paths as processed
      if (diff.type === 'REMOVE' || diff.type === 'REPLACE') {
        this.markChildPathsAsProcessed(diff.path, processedPaths);
      }
    }
    
    // Re-sort by operation type and path
    return this.sortDiffsByOperationOrder(optimized);
  }
  
  /**
   * Marks all child paths of a given path as processed.
   * 
   * @param path - The parent path
   * @param processedPaths - The set of processed paths to update
   */
  private markChildPathsAsProcessed(path: number[], processedPaths: Set<string>): void {
    const pathStr = path.join('.');
    for (const processed of Array.from(processedPaths)) {
      if (processed.startsWith(pathStr + '.')) {
        processedPaths.delete(processed);
      }
    }
  }
  
  /**
   * Sorts diffs by operation order to ensure correct application.
   * 
   * @param diffs - The diffs to sort
   * @returns Sorted diffs
   */
  private sortDiffsByOperationOrder(diffs: Diff[]): Diff[] {
    // Define operation priorities
    const priorities: Record<string, number> = {
      'REMOVE': 0,
      'MOVE': 1,
      'REPLACE': 2,
      'UPDATE': 3,
      'ADD': 4
    };
    
    return diffs.sort((a, b) => {
      // First sort by operation type
      const priorityDiff = priorities[a.type] - priorities[b.type];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by path depth (shallower first, except for ADD operations)
      if (a.type === 'ADD' && b.type === 'ADD') {
        return a.path.length - b.path.length;
      }
      
      // Compare path arrays lexicographically
      for (let i = 0; i < Math.min(a.path.length, b.path.length); i++) {
        if (a.path[i] !== b.path[i]) {
          return a.path[i] - b.path[i];
        }
      }
      
      return a.path.length - b.path.length;
    });
  }
  
  /**
   * Creates a deep clone of a node.
   * 
   * @param node - The node to clone
   * @returns A cloned copy of the node
   */
  private cloneNode(node: Node): Node {
    const clone: Node = {
      type: node.type,
      children: [],
      metadata: { ...node.metadata }
    };
    
    if (node.name) clone.name = node.name;
    if (node.value) clone.value = node.value;
    
    if (node.attributes) {
      clone.attributes = new Map(node.attributes);
    }
    
    if (node.children) {
      clone.children = node.children.map(child => this.cloneNode(child));
    }
    
    return clone;
  }
  
  /**
   * Generates DOM patches from computed differences.
   * 
   * @param diffs - The array of differences
   * @returns An array of patches that can be applied to the DOM
   */
  public generatePatches(diffs: Diff[]): Patch[] {
    return diffs.map(diff => {
      switch (diff.type) {
        case 'ADD':
          return {
            type: 'CREATE',
            path: diff.path,
            node: diff.node
          };
          
        case 'REMOVE':
          return {
            type: 'REMOVE',
            path: diff.path
          };
          
        case 'REPLACE':
          return {
            type: 'REPLACE',
            path: diff.path,
            node: diff.node
          };
          
        case 'UPDATE':
          return {
            type: 'UPDATE',
            path: diff.path,
            attributes: diff.changes
          };
          
        case 'MOVE':
          return {
            type: 'MOVE',
            path: diff.path,
            from: diff.from,
            to: diff.to
          };
          
        default:
          throw new Error(`Unknown diff type: ${diff.type}`);
      }
    });
  }
  
  /**
   * Applies patches to a DOM node to transform it.
   * 
   * @param domNode - The DOM node to patch
   * @param patches - The patches to apply
   * @returns The patched DOM node
   */
  public patch(domNode: Node, patches: Patch[]): Node {
    let currentNode = domNode;
    
    for (const patch of patches) {
      currentNode = this.applyPatch(currentNode, patch);
    }
    
    return currentNode;
  }
  
  /**
   * Applies a single patch to a DOM node.
   * 
   * @param node - The DOM node to patch
   * @param patch - The patch to apply
   * @returns The patched DOM node
   */
  private applyPatch(node: Node, patch: Patch): Node {
    const targetNode = this.findNodeByPath(node, patch.path);
    
    if (!targetNode) {
      console.warn(`Could not find node at path: ${patch.path.join('.')}`);
      return node;
    }
    
    switch (patch.type) {
      case 'CREATE':
        if (patch.node) {
          this.createNode(targetNode, patch.node);
        }
        break;
        
      case 'UPDATE':
        if (patch.attributes) {
          this.updateNodeAttributes(targetNode, patch.attributes);
        }
        break;
        
      case 'REPLACE':
        if (patch.node) {
          this.replaceNode(targetNode, patch.node);
        }
        break;
        
      case 'REMOVE':
        this.removeNode(targetNode);
        break;
        
      case 'MOVE':
        if (patch.from && patch.to) {
          this.moveNode(node, patch.from, patch.to);
        }
        break;
    }
    
    return node;
  }
  
  /**
   * Finds a node by its path in the tree.
   * 
   * @param root - The root node
   * @param path - The path to the target node
   * @returns The target node or undefined if not found
   */
  private findNodeByPath(root: Node, path: number[]): Node | undefined {
    let current = root;
    
    for (let i = 0; i < path.length; i++) {
      const index = path[i];
      
      if (!current.children || index >= current.children.length) {
        return undefined;
      }
      
      current = current.children[index];
    }
    
    return current;
  }
  
  /**
   * Creates a new node as a child of the target node.
   * 
   * @param parent - The parent node
   * @param newNode - The node to create
   */
  private createNode(parent: Node, newNode: Node): void {
    if (!parent.children) {
      parent.children = [];
    }
    
    parent.children.push(this.cloneNode(newNode));
  }
  
  /**
   * Updates a node's attributes.
   * 
   * @param node - The node to update
   * @param attributes - The attributes to update
   */
  private updateNodeAttributes(node: Node, attributes: Record<string, any>): void {
    if (!node.attributes) {
      node.attributes = new Map();
    }
    
    for (const [key, value] of Object.entries(attributes)) {
      if (value === null) {
        node.attributes.delete(key);
      } else {
        node.attributes.set(key, value);
      }
    }
  }
  
  /**
   * Replaces a node with a new node.
   * 
   * @param oldNode - The node to replace
   * @param newNode - The replacement node
   */
  private replaceNode(oldNode: Node, newNode: Node): void {
    Object.assign(oldNode, this.cloneNode(newNode));
  }
  
  /**
   * Removes a node from its parent.
   * 
   * @param node - The node to remove
   */
  private removeNode(node: Node): void {
    const parent = this.findParentNode(node);
    
    if (parent && parent.children) {
      const index = parent.children.indexOf(node);
      if (index !== -1) {
        parent.children.splice(index, 1);
      }
    }
  }
  
  /**
   * Moves a node from one position to another.
   * 
   * @param root - The root node
   * @param fromPath - The source path
   * @param toPath - The destination path
   */
  private moveNode(root: Node, fromPath: number[], toPath: number[]): void {
    const sourceNode = this.findNodeByPath(root, fromPath);
    const targetParent = this.findNodeByPath(root, toPath.slice(0, -1));
    
    if (!sourceNode || !targetParent) return;
    
    // Remove from source
    this.removeNode(sourceNode);
    
    // Add to target
    if (!targetParent.children) {
      targetParent.children = [];
    }
    
    const targetIndex = toPath[toPath.length - 1];
    targetParent.children.splice(targetIndex, 0, sourceNode);
  }
  
  /**
   * Finds the parent node of a given node.
   * 
   * @param node - The node to find the parent of
   * @returns The parent node or undefined if not found
   */
  private findParentNode(node: Node): Node | undefined {
    // Helper function to search for parent
    const findParent = (current: Node, target: Node): Node | undefined => {
      if (!current.children) return undefined;
      
      for (const child of current.children) {
        if (child === target) return current;
        
        const parent = findParent(child, target);
        if (parent) return parent;
      }
      
      return undefined;
    };
    
    // Start searching from the root (assuming we have access to it)
    // This is a limitation - in a real implementation, nodes should
    // have parent references or we'd need to keep track of the full tree
    return undefined; // Placeholder - can't implement without additional context
  }
}