const fs = require("fs");
const f = "server/admin-storage.ts";
const c = fs.readFileSync(f,"utf8");
const lines = c.split("\n");
console.log("=== "+f+" total lines: "+lines.length);
// Find any function that takes a 'search' parameter and how it's used in queries
lines.forEach((ln,i)=>{
  if(/search|ilike|like|where|orderBy|sql/i.test(ln) && !/^\s*\/\//.test(ln)){
    console.log((i+1)+": "+ln);
  }
});
