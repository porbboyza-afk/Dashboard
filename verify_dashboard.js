const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const indexPath = path.join(root, 'index.html');
const manifestPath = path.join(root, 'manifest.json');
const swPath = path.join(root, 'sw.js');
const appsScriptPath = path.join(root, 'apps-script', 'Code.gs');
const extraScripts = [
  path.join(root, 'js', 'date-utils.js'),
  path.join(root, 'js', 'ui-core.js'),
];

function checkJsFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  new vm.Script(code, { filename: path.basename(filePath) });
}

function checkHtmlInlineScripts(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const regex = /<script\b(?![^>]*\btype\s*=\s*["']module["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let count = 0;
  for (const match of html.matchAll(regex)) {
    const code = match[1].trim();
    if (!code) continue;
    new vm.Script(code, { filename: `inline_${count}.js` });
    count += 1;
  }
  return count;
}

function ensureContains(filePath, snippets) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      throw new Error(`Missing snippet in ${path.basename(filePath)}: ${snippet}`);
    }
  }
}

const inlineCount = checkHtmlInlineScripts(indexPath);
checkJsFile(swPath);
for (const scriptPath of extraScripts) {
  checkJsFile(scriptPath);
}

JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
checkJsFile(appsScriptPath);

ensureContains(indexPath, [
  '<script src="js/date-utils.js"></script>',
  '<script src="js/ui-core.js"></script>',
  'function mdToHtml(text)',
  'out.innerHTML = mdToHtml(reply);',
  "catch(e){if(out){out.style.color='var(--text)';out.innerHTML=mdToHtml(rawText);}showToast('Plan created (no JSON save)','warn');return;}",
]);

console.log(`Syntax OK: ${inlineCount} inline scripts, ${extraScripts.length} external scripts, manifest, service worker, Apps Script`);
