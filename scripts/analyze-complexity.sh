#!/bin/bash
# ============================================================================
# Complexity Analysis Script for Fakeflix
# ============================================================================
# Analyzes local and global complexity metrics for modular architecture
#
# Usage:
#   ./scripts/analyze-complexity.sh [module-name]
#   ./scripts/analyze-complexity.sh                  # All modules
#   ./scripts/analyze-complexity.sh content          # Specific module
#   ./scripts/analyze-complexity.sh --json           # JSON output only
#
# Output: Human-readable report + JSON summary
# ============================================================================

set -e

# Configuration
SRC_DIR="src/module"
MODULES=("billing" "content" "identity")
OUTPUT_FORMAT="human"  # human or json
TARGET_MODULE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            OUTPUT_FORMAT="json"
            shift
            ;;
        *)
            TARGET_MODULE="$1"
            shift
            ;;
    esac
done

# If specific module requested, validate it exists
if [ -n "$TARGET_MODULE" ]; then
    if [ ! -d "$SRC_DIR/$TARGET_MODULE" ]; then
        echo "Error: Module '$TARGET_MODULE' not found in $SRC_DIR/" >&2
        exit 1
    fi
    MODULES=("$TARGET_MODULE")
fi

# ============================================================================
# Utility Functions
# ============================================================================

count_files() {
    local dir="$1"
    local pattern="${2:-*.ts}"
    find "$dir" -name "$pattern" -type f 2>/dev/null | wc -l | tr -d ' '
}

count_lines() {
    local file="$1"
    if [ -f "$file" ]; then
        wc -l < "$file" | tr -d ' '
    else
        echo "0"
    fi
}

# ============================================================================
# Local Complexity Metrics
# ============================================================================

analyze_local_complexity() {
    local module="$1"
    local module_path="$SRC_DIR/$module"
    
    # File counts per layer
    local core_files=$(find "$module_path" -path "*/core/*" -name "*.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    local http_files=$(find "$module_path" -path "*/http/*" -name "*.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    local persistence_files=$(find "$module_path" -path "*/persistence/*" -name "*.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    local queue_files=$(find "$module_path" -path "*/queue/*" -name "*.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    local total_files=$(count_files "$module_path" "*.ts")
    
    # Service analysis
    local service_files=$(find "$module_path" -name "*.service.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    local usecase_files=$(find "$module_path" -name "*.use-case.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    
    # Large files (cognitive complexity proxy)
    local large_files=0
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            local lines
            lines=$(wc -l < "$file" | tr -d ' ')
            if [ "$lines" -gt 200 ]; then
                large_files=$((large_files + 1))
            fi
        fi
    done < <(find "$module_path" -name "*.ts" -type f 2>/dev/null)
    
    # Internal imports depth (files importing from same module)
    local internal_imports=$(grep -r "from '\.\./\|from '\./" "$module_path" 2>/dev/null | wc -l | tr -d ' ')
    
    # Entity count
    local entity_count=$(find "$module_path" -name "*.entity.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    
    # Repository count  
    local repo_count=$(find "$module_path" -name "*.repository.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    
    # Sub-modules (for content-like structures)
    local submodule_count=$(find "$module_path" -maxdepth 1 -type d ! -name "__test__" ! -name "." 2>/dev/null | wc -l | tr -d ' ')
    submodule_count=$((submodule_count - 1))  # Subtract the module dir itself
    [ "$submodule_count" -lt 0 ] && submodule_count=0
    
    cat <<EOF
{
    "module": "$module",
    "local": {
        "total_files": $total_files,
        "layers": {
            "core": $core_files,
            "http": $http_files,
            "persistence": $persistence_files,
            "queue": $queue_files
        },
        "services": $service_files,
        "use_cases": $usecase_files,
        "entities": $entity_count,
        "repositories": $repo_count,
        "large_files_over_200_lines": $large_files,
        "internal_imports": $internal_imports,
        "sub_modules": $submodule_count
    }
}
EOF
}

# ============================================================================
# Global Complexity Metrics
# ============================================================================

analyze_global_complexity() {
    local module="$1"
    local module_path="$SRC_DIR/$module"
    
    local boundary_violations=0
    local violation_details=""
    local fan_out=0
    local external_deps=""
    
    # Check boundary violations (imports from other modules' internal layers)
    for other in billing content identity; do
        if [ "$other" != "$module" ] && [ -d "$SRC_DIR/$other" ]; then
            # Count imports from other module's core/persistence (not public-api)
            local violations
            violations=$(grep -r "from '.*module/$other/\(core\|persistence\)" "$module_path" 2>/dev/null | \
                        grep -v "public-api\|integration/provider" | wc -l | tr -d ' ')
            
            if [ "$violations" -gt 0 ]; then
                boundary_violations=$((boundary_violations + violations))
                if [ -n "$violation_details" ]; then
                    violation_details="$violation_details, "
                fi
                violation_details="$violation_details\"$other\": $violations"
            fi
            
            # Check if module depends on other (any import)
            local has_dep
            has_dep=$(grep -r "from '.*module/$other" "$module_path" 2>/dev/null | wc -l | tr -d ' ')
            if [ "$has_dep" -gt 0 ]; then
                fan_out=$((fan_out + 1))
                if [ -n "$external_deps" ]; then
                    external_deps="$external_deps, "
                fi
                external_deps="$external_deps\"$other\""
            fi
        fi
    done
    
    # Check shared module usage
    local shared_imports
    shared_imports=$(grep -r "from '.*module/shared" "$module_path" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$shared_imports" -gt 0 ]; then
        if [ -n "$external_deps" ]; then
            external_deps="$external_deps, "
        fi
        external_deps="$external_deps\"shared\""
        fan_out=$((fan_out + 1))
    fi
    
    # Facade compliance (PublicApiProvider usage)
    local facade_usage
    facade_usage=$(grep -r "PublicApiProvider\|PublicApi\|Facade" "$module_path" 2>/dev/null | wc -l | tr -d ' ')
    
    # Transaction safety
    local transactional_total
    local transactional_with_conn
    transactional_total=$(grep -r "@Transactional" "$module_path" 2>/dev/null | wc -l | tr -d ' ')
    transactional_with_conn=$(grep -r "@Transactional.*connectionName" "$module_path" 2>/dev/null | wc -l | tr -d ' ')
    local transactional_unsafe=$((transactional_total - transactional_with_conn))
    [ "$transactional_unsafe" -lt 0 ] && transactional_unsafe=0
    
    # Queue-based communication (async patterns)
    local queue_producers
    local queue_consumers
    queue_producers=$(find "$module_path" -name "*.queue-producer.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    queue_consumers=$(find "$module_path" -name "*.queue-consumer.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    
    # External API clients
    local external_clients
    external_clients=$(find "$module_path" -name "*.client.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    
    cat <<EOF
{
    "module": "$module",
    "global": {
        "boundary_violations": $boundary_violations,
        "violation_details": {$violation_details},
        "fan_out": $fan_out,
        "external_dependencies": [$external_deps],
        "facade_usage_count": $facade_usage,
        "transactions": {
            "total": $transactional_total,
            "with_connection_name": $transactional_with_conn,
            "unsafe_without_connection": $transactional_unsafe
        },
        "async_communication": {
            "queue_producers": $queue_producers,
            "queue_consumers": $queue_consumers
        },
        "external_api_clients": $external_clients
    }
}
EOF
}

# ============================================================================
# Entity Collision Detection (Cross-Module)
# ============================================================================

check_entity_collisions() {
    local collision_count=0
    local collisions=""
    
    # Find all @Entity declarations and check for duplicates
    local entities
    entities=$(grep -rh "@Entity.*name:" "$SRC_DIR" 2>/dev/null | \
              grep -oE "name: ['\"][^'\"]*['\"]" | \
              sed "s/name: ['\"]//g" | sed "s/['\"]//g" | \
              sort | uniq -d)
    
    if [ -n "$entities" ]; then
        while IFS= read -r entity; do
            if [ -n "$entity" ]; then
                collision_count=$((collision_count + 1))
                # Find which modules have this entity
                local modules_with_entity
                modules_with_entity=$(grep -rl "@Entity.*name:.*$entity" "$SRC_DIR" 2>/dev/null | \
                                     sed "s|$SRC_DIR/||" | cut -d'/' -f1 | sort -u | tr '\n' ', ' | sed 's/,$//')
                if [ -n "$collisions" ]; then
                    collisions="$collisions, "
                fi
                collisions="$collisions\"$entity\": \"$modules_with_entity\""
            fi
        done <<< "$entities"
    fi
    
    cat <<EOF
{
    "entity_collisions": {
        "count": $collision_count,
        "duplicates": {$collisions}
    }
}
EOF
}

# ============================================================================
# Repository Encapsulation Check
# ============================================================================

check_repository_encapsulation() {
    local module="$1"
    local module_path="$SRC_DIR/$module"
    
    local total_repos
    local proper_repos
    total_repos=$(find "$module_path" -name "*.repository.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    proper_repos=$(grep -rl "extends DefaultTypeOrmRepository" "$module_path" 2>/dev/null | wc -l | tr -d ' ')
    local improper_repos=$((total_repos - proper_repos))
    [ "$improper_repos" -lt 0 ] && improper_repos=0
    
    cat <<EOF
{
    "repository_encapsulation": {
        "total": $total_repos,
        "using_default_typeorm_repository": $proper_repos,
        "direct_typeorm_extension": $improper_repos
    }
}
EOF
}

# ============================================================================
# Calculate Scores
# ============================================================================

calculate_scores() {
    local total_files="$1"
    local large_files="$2"
    local boundary_violations="$3"
    local fan_out="$4"
    local unsafe_transactions="$5"
    
    # Local complexity score (0-100, lower is better)
    local local_score=0
    [ "$total_files" -gt 50 ] && local_score=$((local_score + 20))
    [ "$total_files" -gt 100 ] && local_score=$((local_score + 20))
    [ "$large_files" -gt 0 ] && local_score=$((local_score + large_files * 10))
    [ "$local_score" -gt 100 ] && local_score=100
    
    # Global complexity score (0-100, lower is better)
    local global_score=0
    [ "$boundary_violations" -gt 0 ] && global_score=$((global_score + boundary_violations * 25))
    [ "$fan_out" -gt 2 ] && global_score=$((global_score + (fan_out - 2) * 10))
    [ "$unsafe_transactions" -gt 0 ] && global_score=$((global_score + unsafe_transactions * 15))
    [ "$global_score" -gt 100 ] && global_score=100
    
    local overall=$(( (local_score + global_score) / 2 ))
    local rating
    
    if [ "$overall" -le 20 ]; then
        rating="EXCELLENT"
    elif [ "$overall" -le 40 ]; then
        rating="GOOD"
    elif [ "$overall" -le 60 ]; then
        rating="MODERATE"
    elif [ "$overall" -le 80 ]; then
        rating="CONCERNING"
    else
        rating="CRITICAL"
    fi
    
    cat <<EOF
{
    "scores": {
        "local_complexity": $local_score,
        "global_complexity": $global_score,
        "overall": $overall
    },
    "rating": "$rating"
}
EOF
}

# ============================================================================
# Human-Readable Output
# ============================================================================

print_header() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                    COMPLEXITY ANALYSIS REPORT - FAKEFLIX                     ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo ""
}

print_module_report() {
    local module="$1"
    local total_files="$2"
    local core_files="$3"
    local http_files="$4"
    local persistence_files="$5"
    local queue_files="$6"
    local services="$7"
    local use_cases="$8"
    local large_files="$9"
    local boundary_violations="${10}"
    local fan_out="${11}"
    local facade_usage="${12}"
    local queue_producers="${13}"
    local queue_consumers="${14}"
    local external_clients="${15}"
    local unsafe_transactions="${16}"
    local total_repos="${17}"
    local proper_repos="${18}"
    local local_score="${19}"
    local global_score="${20}"
    local overall="${21}"
    local rating="${22}"
    
    echo "┌──────────────────────────────────────────────────────────────────────────────┐"
    echo "│ MODULE: $module"
    echo "└──────────────────────────────────────────────────────────────────────────────┘"
    echo ""
    
    echo "  LOCAL COMPLEXITY"
    echo "  ────────────────"
    echo "  Total Files:        $total_files"
    echo "  Core Layer:         $core_files"
    echo "  HTTP Layer:         $http_files"
    echo "  Persistence Layer:  $persistence_files"
    echo "  Queue Layer:        $queue_files"
    echo "  Services:           $services"
    echo "  Use Cases:          $use_cases"
    echo "  Large Files (>200): $large_files"
    echo ""
    
    echo "  GLOBAL COMPLEXITY"
    echo "  ─────────────────"
    if [ "$boundary_violations" -gt 0 ]; then
        echo "  Boundary Violations: $boundary_violations ❌"
    else
        echo "  Boundary Violations: 0 ✅"
    fi
    echo "  Fan-Out (deps):     $fan_out"
    echo "  Facade Usage:       $facade_usage"
    echo "  Queue Producers:    $queue_producers"
    echo "  Queue Consumers:    $queue_consumers"
    echo "  External Clients:   $external_clients"
    
    if [ "$unsafe_transactions" -gt 0 ]; then
        echo "  Unsafe Transactions: $unsafe_transactions ⚠️"
    else
        echo "  Unsafe Transactions: 0 ✅"
    fi
    echo ""
    
    echo "  REPOSITORY ENCAPSULATION"
    echo "  ────────────────────────"
    if [ "$total_repos" -eq "$proper_repos" ]; then
        echo "  Repositories:       $proper_repos/$total_repos ✅"
    else
        echo "  Repositories:       $proper_repos/$total_repos ⚠️"
    fi
    echo ""
    
    echo "  SCORES"
    echo "  ──────"
    echo "  Local Score:        $local_score/100"
    echo "  Global Score:       $global_score/100"
    echo "  Overall:            $overall/100"
    echo "  Rating:             $rating"
    echo ""
}

print_entity_collisions() {
    local count="$1"
    
    echo "┌──────────────────────────────────────────────────────────────────────────────┐"
    echo "│ CROSS-MODULE: ENTITY COLLISIONS                                             │"
    echo "└──────────────────────────────────────────────────────────────────────────────┘"
    
    if [ "$count" -eq 0 ]; then
        echo "  No entity name collisions detected ✅"
    else
        echo "  ❌ Found $count entity name collision(s)!"
        echo "  Review docs/MODULAR-ARCHITECTURE-GUIDELINES.md section 'State Isolation'"
    fi
    echo ""
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    local json_modules="["
    local first_module=true
    
    if [ "$OUTPUT_FORMAT" = "human" ]; then
        print_header
    fi
    
    # Entity collision check (cross-module)
    local collision_json
    collision_json=$(check_entity_collisions)
    local collision_count
    collision_count=$(echo "$collision_json" | grep '"count":' | grep -oE '[0-9]+')
    
    if [ "$OUTPUT_FORMAT" = "human" ]; then
        print_entity_collisions "$collision_count"
    fi
    
    for module in "${MODULES[@]}"; do
        # Run analysis
        local local_json
        local global_json
        local repo_json
        
        local_json=$(analyze_local_complexity "$module")
        global_json=$(analyze_global_complexity "$module")
        repo_json=$(check_repository_encapsulation "$module")
        
        # Extract values for scoring
        local total_files core_files http_files persistence_files queue_files
        local services use_cases large_files internal_imports
        local boundary_violations fan_out facade_usage
        local queue_producers queue_consumers external_clients
        local transactional_total transactional_with_conn unsafe_transactions
        local total_repos proper_repos
        
        total_files=$(echo "$local_json" | grep '"total_files":' | grep -oE '[0-9]+')
        core_files=$(echo "$local_json" | grep '"core":' | grep -oE '[0-9]+')
        http_files=$(echo "$local_json" | grep '"http":' | grep -oE '[0-9]+')
        persistence_files=$(echo "$local_json" | grep '"persistence":' | grep -oE '[0-9]+')
        queue_files=$(echo "$local_json" | grep '"queue":' | grep -oE '[0-9]+')
        services=$(echo "$local_json" | grep '"services":' | grep -oE '[0-9]+')
        use_cases=$(echo "$local_json" | grep '"use_cases":' | grep -oE '[0-9]+')
        large_files=$(echo "$local_json" | grep '"large_files_over_200_lines":' | sed 's/.*: *//' | tr -d ' ,')
        
        boundary_violations=$(echo "$global_json" | grep '"boundary_violations":' | grep -oE '[0-9]+')
        fan_out=$(echo "$global_json" | grep '"fan_out":' | grep -oE '[0-9]+')
        facade_usage=$(echo "$global_json" | grep '"facade_usage_count":' | grep -oE '[0-9]+')
        queue_producers=$(echo "$global_json" | grep '"queue_producers":' | grep -oE '[0-9]+')
        queue_consumers=$(echo "$global_json" | grep '"queue_consumers":' | grep -oE '[0-9]+')
        external_clients=$(echo "$global_json" | grep '"external_api_clients":' | grep -oE '[0-9]+')
        unsafe_transactions=$(echo "$global_json" | grep '"unsafe_without_connection":' | grep -oE '[0-9]+')
        
        total_repos=$(echo "$repo_json" | grep '"total":' | grep -oE '[0-9]+')
        proper_repos=$(echo "$repo_json" | grep '"using_default_typeorm_repository":' | grep -oE '[0-9]+')
        
        # Calculate scores
        local scores_json
        scores_json=$(calculate_scores "$total_files" "$large_files" "$boundary_violations" "$fan_out" "$unsafe_transactions")
        
        local local_score global_score overall rating
        local_score=$(echo "$scores_json" | grep '"local_complexity":' | grep -oE '[0-9]+')
        global_score=$(echo "$scores_json" | grep '"global_complexity":' | grep -oE '[0-9]+')
        overall=$(echo "$scores_json" | grep '"overall":' | grep -oE '[0-9]+')
        rating=$(echo "$scores_json" | grep '"rating":' | grep -oE '"[A-Z]+"' | tr -d '"')
        
        if [ "$OUTPUT_FORMAT" = "human" ]; then
            print_module_report "$module" "$total_files" "$core_files" "$http_files" \
                "$persistence_files" "$queue_files" "$services" "$use_cases" "$large_files" \
                "$boundary_violations" "$fan_out" "$facade_usage" "$queue_producers" \
                "$queue_consumers" "$external_clients" "$unsafe_transactions" \
                "$total_repos" "$proper_repos" "$local_score" "$global_score" "$overall" "$rating"
        fi
        
        # Build JSON output
        if [ "$first_module" = true ]; then
            first_module=false
        else
            json_modules="$json_modules,"
        fi
        
        json_modules="$json_modules
    {
        \"module\": \"$module\",
        \"local\": {
            \"total_files\": $total_files,
            \"core\": $core_files,
            \"http\": $http_files,
            \"persistence\": $persistence_files,
            \"queue\": $queue_files,
            \"services\": $services,
            \"use_cases\": $use_cases,
            \"large_files\": $large_files
        },
        \"global\": {
            \"boundary_violations\": $boundary_violations,
            \"fan_out\": $fan_out,
            \"facade_usage\": $facade_usage,
            \"queue_producers\": $queue_producers,
            \"queue_consumers\": $queue_consumers,
            \"external_clients\": $external_clients,
            \"unsafe_transactions\": $unsafe_transactions
        },
        \"repository\": {
            \"total\": $total_repos,
            \"proper\": $proper_repos
        },
        \"scores\": {
            \"local\": $local_score,
            \"global\": $global_score,
            \"overall\": $overall
        },
        \"rating\": \"$rating\"
    }"
    done
    
    json_modules="$json_modules
]"
    
    # Final JSON output
    local final_json="{
    \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
    \"entity_collisions\": $collision_count,
    \"modules\": $json_modules
}"
    
    if [ "$OUTPUT_FORMAT" = "json" ]; then
        echo "$final_json"
    else
        echo "┌──────────────────────────────────────────────────────────────────────────────┐"
        echo "│ JSON OUTPUT (for AI consumption)                                            │"
        echo "└──────────────────────────────────────────────────────────────────────────────┘"
        echo ""
        echo "$final_json"
    fi
}

main
