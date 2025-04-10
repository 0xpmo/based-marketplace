#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Regular expressions for identifying potential private keys and secrets
const patterns = {
  // Ethereum private keys (64 hex characters or with 0x prefix)
  ethereumPrivateKey: /['"`]?(0x)?[0-9a-fA-F]{64}['"`]?/g,
  
  // Mnemonic phrases (typically 12 or 24 words)
  mnemonicPhrase: /['"`]?[a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+(\s[a-z]+)*['"`]?/gi,
  
  // Environment variables for keys
  envKeyAssignment: /[A-Z_]*(KEY|SECRET|PASSWORD|MNEMONIC|PRIVATE)[A-Z_]*\s*=\s*['"`].+['"`]/gi,
  
  // Infura/Alchemy/RPC endpoints with project IDs
  rpcEndpoints: /https:\/\/(mainnet|goerli|sepolia|rinkeby|kovan|ropsten)\.infura\.io\/v3\/[0-9a-zA-Z]{32}/g,
  alchemyEndpoints: /https:\/\/eth-[a-zA-Z0-9]+\.alchemyapi\.io\/v2\/[0-9a-zA-Z_-]+/g,
  
  // API keys specific patterns
  apiKey: /['"`]?[a-zA-Z0-9_-]{20,64}['"`]?/g,
  
  // JWT tokens
  jwtToken: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g
};

// Files/paths to ignore
const ignorePaths = [
  'node_modules',
  'build',
  'dist',
  '.git',
  'package-lock.json',
  'yarn.lock'
];

// File extensions to check
const checkExtensions = [
  '.js', '.jsx', '.ts', '.tsx', '.json', '.env', 
  '.sol', '.md', '.yaml', '.yml', '.toml', '.sh', 
  '.config.js', '.html', '.txt'
];

// Get all commit hashes
function getAllCommits() {
  const output = execSync('git log --pretty=format:"%H"').toString();
  return output.split('\n');
}

// Check a specific file content against all patterns
function checkContent(content, filePath, commitHash, commitDate) {
  let foundSecrets = [];
  
  for (const [patternName, pattern] of Object.entries(patterns)) {
    const matches = content.match(pattern);
    
    if (matches) {
      for (const match of matches) {
        // Skip obvious false positives
        if (isLikelyFalsePositive(match, patternName)) continue;
        
        // Get the line number and context
        const lines = content.split('\n');
        let lineNumber = 0;
        let lineContent = '';
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(match)) {
            lineNumber = i + 1;
            lineContent = lines[i].trim();
            break;
          }
        }
        
        foundSecrets.push({
          pattern: patternName,
          match: sanitizeMatch(match, patternName),
          filePath,
          lineNumber,
          lineContent: sanitizeLine(lineContent),
          commitHash,
          commitDate
        });
      }
    }
  }
  
  return foundSecrets;
}

// Sanitize the match to avoid displaying actual secrets in the report
function sanitizeMatch(match, patternName) {
  if (patternName === 'ethereumPrivateKey') {
    return match.substring(0, 6) + '...' + match.substring(match.length - 4);
  }
  if (patternName === 'mnemonicPhrase') {
    const words = match.split(' ');
    return words.slice(0, 2).join(' ') + ' ... ' + words.slice(-2).join(' ');
  }
  if (patternName === 'apiKey' || patternName === 'jwtToken') {
    return match.substring(0, 5) + '...' + match.substring(match.length - 3);
  }
  
  // For other patterns, show type but hide actual value
  if (match.includes('=')) {
    const parts = match.split('=');
    return parts[0] + '= [HIDDEN VALUE]';
  }
  
  return match.substring(0, 4) + '...' + match.substring(match.length - 3);
}

// Sanitize the line content for reporting
function sanitizeLine(line) {
  // Replace the value part in key-value assignments
  if (line.includes('=') && (line.includes('"') || line.includes("'") || line.includes('`'))) {
    const parts = line.split('=');
    return parts[0] + '= "[HIDDEN VALUE]"';
  }
  
  // Otherwise return a shortened version
  if (line.length > 80) {
    return line.substring(0, 30) + ' ... ' + line.substring(line.length - 30);
  }
  
  return line;
}

// Check if a match is likely a false positive
function isLikelyFalsePositive(match, patternName) {
  // Ethereum address (not a private key)
  if (patternName === 'ethereumPrivateKey' && match.length === 42 && match.startsWith('0x')) {
    return true;
  }
  
  // Common false positives for API keys
  if (patternName === 'apiKey') {
    const lowercaseMatch = match.toLowerCase();
    return (
      // Test vectors, examples, etc.
      lowercaseMatch.includes('example') ||
      lowercaseMatch.includes('test') ||
      lowercaseMatch.includes('sample') ||
      // Public identifiers that aren't secrets
      match.length < 25 ||
      // Common hex values for contract addresses, etc.
      /^(0x)?[0-9a-f]{40}$/i.test(match)
    );
  }
  
  return false;
}

// Main function to scan all commits
async function scanAllCommits() {
  try {
    const commits = getAllCommits();
    console.log(`Found ${commits.length} commits to scan`);
    
    let allSecrets = [];
    let processedCommits = 0;
    
    for (const commitHash of commits) {
      processedCommits++;
      if (processedCommits % 10 === 0) {
        console.log(`Scanning commit ${processedCommits}/${commits.length}...`);
      }
      
      try {
        // Get commit date
        const commitDate = execSync(`git show -s --format=%ci ${commitHash}`).toString().trim();
        
        // Get files changed in this commit
        const changedFiles = execSync(`git diff-tree --no-commit-id --name-only -r ${commitHash}`).toString().split('\n');
        
        for (const file of changedFiles) {
          if (!file) continue;
          
          // Skip ignored paths
          if (ignorePaths.some(ignored => file.includes(ignored))) continue;
          
          // Check if the file extension is in our list
          const ext = path.extname(file);
          if (!checkExtensions.includes(ext) && !file.includes('.env')) continue;
          
          try {
            // Get file content at this commit
            const content = execSync(`git show ${commitHash}:${file}`).toString();
            
            // Check content for patterns
            const foundSecrets = checkContent(content, file, commitHash, commitDate);
            
            if (foundSecrets.length > 0) {
              allSecrets = [...allSecrets, ...foundSecrets];
            }
          } catch (fileErr) {
            // File may not exist in this commit, which is fine
          }
        }
      } catch (commitErr) {
        console.error(`Error processing commit ${commitHash}: ${commitErr.message}`);
      }
    }
    
    // Output results
    console.log('\n========== SCAN COMPLETE ==========\n');
    
    if (allSecrets.length === 0) {
      console.log('✅ No potential secrets or private keys found in the commit history.');
    } else {
      console.log(`⚠️ ALERT: Found ${allSecrets.length} potential secrets in the commit history:`);
      
      // Group by file path
      const secretsByFile = {};
      for (const secret of allSecrets) {
        if (!secretsByFile[secret.filePath]) {
          secretsByFile[secret.filePath] = [];
        }
        secretsByFile[secret.filePath].push(secret);
      }
      
      // Output detailed findings
      for (const [filePath, secrets] of Object.entries(secretsByFile)) {
        console.log(`\nFile: ${filePath}`);
        
        for (const secret of secrets) {
          console.log(`  - Type: ${secret.pattern}`);
          console.log(`    Commit: ${secret.commitHash.substring(0, 8)} (${secret.commitDate})`);
          console.log(`    Line ${secret.lineNumber}: ${secret.lineContent}`);
          console.log(`    Potential secret: ${secret.match}`);
          console.log('    -----------------------');
        }
      }
      
      console.log('\n⚠️ IMPORTANT: Review these findings and remove any actual secrets from your Git history!');
      console.log('Read more about removing sensitive data: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository');
    }
    
  } catch (error) {
    console.error('Error scanning commits:', error.message);
  }
}

// Run the scan
scanAllCommits();
