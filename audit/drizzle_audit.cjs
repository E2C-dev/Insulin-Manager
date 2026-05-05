const fs = require("fs");
const path = require("path");
const targets = ["server", "shared"];
const files = [];
function walk(d){ for(const f of fs.readdirSync(d)){ const p=path.join(d,f); const s=fs.statSync(p); if(s.isDirectory()) walk(p); else if(/\.ts$/.test(p)) files.push(p);} }
targets.forEach(t=>{ if(fs.existsSync(t)) walk(t); });
const patterns = {
  "sql.identifier": /sql\.identifier\s*\(/,
  "sql.raw": /sql\.raw\s*\(/,
  "sql.unsafe": /sql\.unsafe\s*\(/,
  "sql_template_backtick": /\bsql`/,
  "orderBy_with_user_input": /orderBy[\s\S]{0,200}(req\.(body|query|params))/,
  "drizzle_import": /from ["']drizzle-orm/,
  "asc_desc_dynamic": /(\basc\(|\bdesc\()[\s\S]{0,100}(req\.|input\.|sortBy|orderBy)/,
  "raw_query_pg": /pool\.query\s*\(|client\.query\s*\(/,
};
const results = {};
for(const k of Object.keys(patterns)) results[k]=[];
for(const f of files){
  const c = fs.readFileSync(f,"utf8");
  const lines = c.split("\n");
  for(const [k,re] of Object.entries(patterns)){
    lines.forEach((ln,i)=>{ if(re.test(ln)) results[k].push(f+":"+(i+1)+"  "+ln.trim().slice(0,220)); });
  }
}
console.log("FILES_SCANNED="+files.length);
for(const [k,arr] of Object.entries(results)){
  console.log("\n=== "+k+" ("+arr.length+") ===");
  arr.slice(0,120).forEach(x=>console.log(x));
}

// Additionally: find every line containing ` sql\` ` (backticked) plus the next 3 lines for inspection
console.log("\n=== sql_template_blocks_with_context ===");
for(const f of files){
  const lines = fs.readFileSync(f,"utf8").split("\n");
  for(let i=0;i<lines.length;i++){
    if(/\bsql`/.test(lines[i])){
      const block = lines.slice(i, Math.min(i+5, lines.length)).join(" | ");
      if(/\$\{/.test(block)){
        console.log(f+":"+(i+1)+"  "+block.slice(0,400));
      }
    }
  }
}
