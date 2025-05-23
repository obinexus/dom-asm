
/**
 * Enum-like object defining CSS token types
 */
export const CSSTokenType = {
    // Structure tokens
    StartBlock: 'StartBlock',     // {
    EndBlock: 'EndBlock',         // }
    Semicolon: 'Semicolon',       // ;
    Colon: 'Colon',              // :
    Comma: 'Comma',              // ,
    
    // Selector tokens
    Selector: 'Selector',         // e.g., .class, #id, element
    PseudoClass: 'PseudoClass',   // e.g., :hover
    PseudoElement: 'PseudoElement', // e.g., ::before
    Combinator: 'Combinator',     // e.g., >, +, ~
    
    // Property and value tokens
    Property: 'Property',         // e.g., color, margin
    Value: 'Value',              // e.g., red, 20px
    Unit: 'Unit',                // e.g., px, em, %
    Number: 'Number',            // e.g., 42, 1.5
    Color: 'Color',              // e.g., #fff, rgb()
    URL: 'URL',                  // e.g., url()
    String: 'String',            // e.g., "text", 'text'
    
    // Function tokens
    Function: 'Function',         // e.g., rgb(), calc()
    OpenParen: 'OpenParen',       // (
    CloseParen: 'CloseParen',     // )
    
    // Special tokens
    AtKeyword: 'AtKeyword',       // e.g., @media, @import
    Comment: 'Comment',           // /* comment */
    Whitespace: 'Whitespace',     // space, tab, newline
    EOF: 'EOF',                  // End of file
    
    // Meta tokens for state tracking
    Error: 'Error'               // Invalid token
  } as const;
  
  export type TokenType = typeof CSSTokenType[keyof typeof CSSTokenType];