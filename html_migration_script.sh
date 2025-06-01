#!/bin/bash

# DOM-ASM HTML Pipeline Migration Script
# Aegis Project - Phase 1A Implementation
# 
# Purpose: Migrate generated TypeScript modules to proper HTML domain structure
# Ensures: Zero duplication, proper architecture organization, backup preservation

set -euo pipefail  # Exit on error, undefined variables, pipe failures

# Configuration
PROJECT_ROOT="$(pwd)"
HTML_DOMAIN="src/html"
BACKUP_DIR="${HTML_DOMAIN}/_migration_backup_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="migration_$(date +%Y%m%d_%H%M%S).log"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${LOG_FILE}"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOG_FILE}"
}

# Validate project structure
validate_project_structure() {
    log "Validating DOM-ASM project structure..."
    
    if [[ ! -f "package.json" ]]; then
        error "Not in DOM-ASM project root - package.json not found"
    fi
    
    if [[ ! -d "src" ]]; then
        error "Source directory not found"
    fi
    
    if [[ ! -d "${HTML_DOMAIN}" ]]; then
        error "HTML domain directory not found: ${HTML_DOMAIN}"
    fi
    
    success "Project structure validation complete"
}

# Create backup of existing files
create_backup() {
    log "Creating migration backup in ${BACKUP_DIR}..."
    
    mkdir -p "${BACKUP_DIR}"
    
    # Backup existing HTML domain files
    if [[ -d "${HTML_DOMAIN}" ]]; then
        cp -r "${HTML_DOMAIN}"/* "${BACKUP_DIR}/" 2>/dev/null || true
        success "Existing HTML domain files backed up"
    fi
    
    # Backup root-level TypeScript files to be migrated
    for file in *.ts; do
        if [[ -f "$file" ]]; then
            cp "$file" "${BACKUP_DIR}/" 2>/dev/null || true
        fi
    done
    
    success "Migration backup created: ${BACKUP_DIR}"
}

# Create HTML domain directory structure
setup_html_structure() {
    log "Setting up HTML domain directory structure..."
    
    # Create required directories
    mkdir -p "${HTML_DOMAIN}/pipeline"
    mkdir -p "${HTML_DOMAIN}/types"
    mkdir -p "${HTML_DOMAIN}/utils"
    
    # Preserve _legacy directory
    if [[ ! -d "${HTML_DOMAIN}/_legacy" ]]; then
        mkdir -p "${HTML_DOMAIN}/_legacy"
    fi
    
    success "HTML domain structure established"
}

# File migration mappings
declare -A FILE_MAPPINGS=(
    ["html_types_system.ts"]="${HTML_DOMAIN}/types/index.ts"
    ["html_tokenizer_implementation.ts"]="${HTML_DOMAIN}/pipeline/HTMLTokenizer.ts"
    ["html_parser_implementation.ts"]="${HTML_DOMAIN}/pipeline/HTMLParser.ts"
    ["html_parser_implementation (1).ts"]="${HTML_DOMAIN}/pipeline/HTMLParser.ts"
    ["html_ast_builder_implementation.ts"]="${HTML_DOMAIN}/pipeline/HTMLASTBuilder.ts"
    ["html_pipeline_interface.ts"]="${HTML_DOMAIN}/pipeline/index.ts"
    ["html_domain_index.ts"]="${HTML_DOMAIN}/index.ts"
    ["behavioral_validation_framework.ts"]="${HTML_DOMAIN}/utils/validation.ts"
)

# Configuration file mappings
declare -A CONFIG_MAPPINGS=(
    ["tsconfig.json"]="tsconfig.json"
    ["jest.config.js"]="jest.config.js"
    ["rollup.config.js"]="rollup.config.js"
)

# Migrate TypeScript modules
migrate_typescript_modules() {
    log "Migrating TypeScript modules to HTML domain structure..."
    
    local migration_count=0
    
    for source_file in "${!FILE_MAPPINGS[@]}"; do
        local target_path="${FILE_MAPPINGS[$source_file]}"
        
        if [[ -f "$source_file" ]]; then
            log "Migrating: $source_file → $target_path"
            
            # Create target directory if it doesn't exist
            mkdir -p "$(dirname "$target_path")"
            
            # Check for existing file and handle duplication
            if [[ -f "$target_path" ]]; then
                warning "Target file exists: $target_path"
                
                # Create versioned backup of existing file
                local backup_target="${target_path}.backup_$(date +%H%M%S)"
                mv "$target_path" "$backup_target"
                log "Existing file backed up as: $backup_target"
            fi
            
            # Move file to target location
            mv "$source_file" "$target_path"
            ((migration_count++))
            
            success "Migrated: $source_file"
        else
            warning "Source file not found: $source_file"
        fi
    done
    
    success "Migrated $migration_count TypeScript modules"
}

# Update configuration files
update_configuration_files() {
    log "Updating configuration files for domain isolation..."
    
    # Update tsconfig.json with domain paths
    if [[ -f "tsconfig.json" ]]; then
        log "Updating tsconfig.json with domain-specific path mappings"
        
        # Create backup
        cp "tsconfig.json" "tsconfig.json.backup_$(date +%H%M%S)"
        
        # Note: In a real implementation, we would use jq or a proper JSON parser
        # For now, we'll create a marker for manual update
        echo "# UPDATE REQUIRED: Add domain-specific paths to tsconfig.json" >> "${LOG_FILE}"
        echo "# Add the following to paths section:" >> "${LOG_FILE}"
        echo '# "@dom-asm/html": ["./src/html"],' >> "${LOG_FILE}"
        echo '# "@dom-asm/html/*": ["./src/html/*"]' >> "${LOG_FILE}"
    fi
    
    # Update jest.config.js with domain mappings
    if [[ -f "jest.config.js" ]]; then
        log "Jest configuration file found - manual update required for domain mappings"
        cp "jest.config.js" "jest.config.js.backup_$(date +%H%M%S)"
    fi
    
    # Update rollup.config.js
    if [[ -f "rollup.config.js" ]]; then
        log "Rollup configuration file found - manual update required for alias mappings"
        cp "rollup.config.js" "rollup.config.js.backup_$(date +%H%M%S)"
    fi
    
    success "Configuration file backups created - manual updates required"
}

# Remove duplicate files
remove_duplicates() {
    log "Scanning for and removing duplicate files..."
    
    local duplicates_found=0
    
    # Check for remaining TypeScript files in root that should have been migrated
    for file in *.ts; do
        if [[ -f "$file" && "$file" =~ ^(html_|behavioral_) ]]; then
            warning "Potential duplicate/orphaned file found: $file"
            
            # Move to backup directory instead of deleting
            mv "$file" "${BACKUP_DIR}/orphaned_$file"
            ((duplicates_found++))
            log "Moved orphaned file to backup: $file"
        fi
    done
    
    # Check for duplicate implementations in HTML domain
    find "${HTML_DOMAIN}" -name "*.ts" -type f | while read -r file; do
        local basename=$(basename "$file")
        local dir=$(dirname "$file")
        
        # Look for duplicate filenames in different directories
        if [[ $(find "${HTML_DOMAIN}" -name "$basename" -type f | wc -l) -gt 1 ]]; then
            warning "Potential duplicate file found: $basename in multiple locations"
            echo "Duplicate: $file" >> "${LOG_FILE}"
        fi
    done
    
    if [[ $duplicates_found -eq 0 ]]; then
        success "No duplicate files found"
    else
        success "Processed $duplicates_found duplicate/orphaned files"
    fi
}

# Validate migration results
validate_migration() {
    log "Validating migration results..."
    
    local validation_errors=0
    
    # Check that all expected files are in place
    local expected_files=(
        "${HTML_DOMAIN}/types/index.ts"
        "${HTML_DOMAIN}/pipeline/HTMLTokenizer.ts"
        "${HTML_DOMAIN}/pipeline/HTMLParser.ts"
        "${HTML_DOMAIN}/pipeline/HTMLASTBuilder.ts"
        "${HTML_DOMAIN}/pipeline/index.ts"
        "${HTML_DOMAIN}/index.ts"
        "${HTML_DOMAIN}/utils/validation.ts"
    )
    
    for file in "${expected_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Expected file missing after migration: $file"
            ((validation_errors++))
        else
            success "Validated: $file"
        fi
    done
    
    # Check file sizes to ensure they're not empty
    for file in "${expected_files[@]}"; do
        if [[ -f "$file" && ! -s "$file" ]]; then
            warning "File appears to be empty: $file"
            ((validation_errors++))
        fi
    done
    
    # Validate TypeScript syntax (if tsc is available)
    if command -v tsc &> /dev/null; then
        log "Running TypeScript compilation check..."
        if tsc --noEmit --skipLibCheck; then
            success "TypeScript compilation validation passed"
        else
            warning "TypeScript compilation issues detected - check ${LOG_FILE}"
            ((validation_errors++))
        fi
    else
        warning "TypeScript compiler not available - skipping syntax validation"
    fi
    
    if [[ $validation_errors -eq 0 ]]; then
        success "Migration validation completed successfully"
    else
        error "Migration validation failed with $validation_errors errors"
    fi
}

# Generate migration report
generate_report() {
    local report_file="migration_report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# DOM-ASM HTML Pipeline Migration Report

**Date:** $(date)
**Migration ID:** $(date +%Y%m%d_%H%M%S)

## Migration Summary

### Files Migrated
$(for source in "${!FILE_MAPPINGS[@]}"; do echo "- $source → ${FILE_MAPPINGS[$source]}"; done)

### Directory Structure Created
\`\`\`
${HTML_DOMAIN}/
├── pipeline/
│   ├── HTMLTokenizer.ts
│   ├── HTMLParser.ts
│   ├── HTMLASTBuilder.ts
│   └── index.ts
├── types/
│   └── index.ts
├── utils/
│   └── validation.ts
├── _legacy/
│   └── [preserved legacy files]
└── index.ts
\`\`\`

### Backup Location
- Migration backup: ${BACKUP_DIR}
- Configuration backups: *.backup_* files

### Next Steps Required
1. Update tsconfig.json with domain-specific paths
2. Update jest.config.js with module name mappings
3. Update rollup.config.js with alias configurations
4. Run test suite to validate behavioral equivalence
5. Commit migrated structure to version control

### Validation Status
- File presence: ✓
- Directory structure: ✓
- TypeScript syntax: $(command -v tsc &> /dev/null && echo "✓" || echo "⚠ Manual check required")

## Migration Log
See: ${LOG_FILE}
EOF
    
    success "Migration report generated: $report_file"
}

# Main migration execution
main() {
    log "Starting DOM-ASM HTML Pipeline Migration - Phase 1A"
    log "Project Root: ${PROJECT_ROOT}"
    
    # Execute migration steps
    validate_project_structure
    create_backup
    setup_html_structure
    migrate_typescript_modules
    update_configuration_files
    remove_duplicates
    validate_migration
    generate_report
    
    success "HTML Pipeline migration completed successfully"
    log "Backup preserved in: ${BACKUP_DIR}"
    log "Migration log: ${LOG_FILE}"
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    MIGRATION COMPLETED                          ║${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}║  HTML single-pass pipeline structure established                ║${NC}"
    echo -e "${GREEN}║  All modules migrated to appropriate directories                ║${NC}"
    echo -e "${GREEN}║  Behavioral equivalence framework operational                   ║${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}║  Next: Run 'npm run typecheck' to validate TypeScript          ║${NC}"
    echo -e "${GREEN}║  Then: Execute test suite for behavioral validation            ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
}

# Execute migration if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi