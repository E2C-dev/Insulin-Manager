const fs = require("fs");
const path = require("path");
const targets = ["server", "shared"];
const files = [];
function walk(d){ for(const f of fs.readdirSync(d)){ const p=path.join(d,f); const s=fs.statSync(p); if(s.isDirectory()) walk(p); else if(/\.ts$/.test(p)) files.push(p);} }
targets.forEach(t=>{ if(fs.existsSync(t)) walk(t); });

console.log("=== ALL sql_template_with_${ interpolation ===");
for(const f of files){
  const c = fs.readFileSync(f,"utf8");
  const lines = c.split("\n");
  for(let i=0;i<lines.length;i++){
    if(/\bsql`[^`]*\$\{/.test(lines[i])){
      console.log(f+":"+(i+1)+"  "+lines[i].trim());
    }
  }
}

console.log("\n=== zod usage (input validation) ===");
let zodCount = 0;
for(const f of files){
  const c = fs.readFileSync(f,"utf8");
  const m = c.match(/from ["']zod["']/g);
  if(m){ zodCount++; console.log(f+"  imports zod"); }
  const parseCount = (c.match(/\.parse\(|\.safeParse\(/g)||[]).length;
  if(parseCount>0) console.log(f+"  parse() calls: "+parseCount);
}
console.log("zod-importing files: "+zodCount);

console.log("\n=== request param/body/query touches in route handlers ===");
for(const f of ["server/routes.ts","server/admin-routes.ts"]){
  if(!fs.existsSync(f)) continue;
  const c = fs.readFileSync(f,"utf8");
  console.log("\n--- "+f+" total lines: "+c.split("\n").length);
  const lines = c.split("\n");
  lines.forEach((ln,i)=>{
    if(/req\.(body|query|params)/.test(ln)){
      console.log(f+":"+(i+1)+"  "+ln.trim().slice(0,180));
    }
  });
}

console.log("\n=== logger / morgan / pino / winston ===");
for(const f of files){
  const c = fs.readFileSync(f,"utf8");
  if(/morgan|winston|pino|express-winston|requestLogger/.test(c)){
    console.log(f);
  }
}

console.log("\n=== route handler count ===");
for(const f of ["server/routes.ts","server/admin-routes.ts"]){
  if(!fs.existsSync(f)) continue;
  const c = fs.readFileSync(f,"utf8");
  const m = c.match(/app\.(get|post|put|delete|patch)\s*\(/g);
  console.log(f+": "+(m?m.length:0)+" handlers");
}
