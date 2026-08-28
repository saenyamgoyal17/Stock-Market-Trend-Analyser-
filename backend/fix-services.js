import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'src', 'services');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix logger.error('msg', { error }) -> logger.error({ err: error }, 'msg')
  content = content.replace(/logger\.error\('([^']+)',\s*\{\s*error\s*\}\);/g, "logger.error({ err: error }, '$1');");
  
  // Fix claude import in ai.service.ts
  if (file === 'ai.service.ts') {
    content = content.replace(/import\s*\{\s*claude\s*\}\s*from\s*'..\/lib\/claude.js';/g, "import { anthropic as claude } from '../lib/claude.js';");
  }
  
  // Fix exchangeRate.client.js to exchangerate.client.js in fx.service.ts
  if (file === 'fx.service.ts') {
    content = content.replace(/exchangeRate\.client\.js/g, "exchangerate.client.js");
  }
  
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Fixed ${file}`);
}
