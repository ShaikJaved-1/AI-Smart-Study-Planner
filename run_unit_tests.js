const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const result = spawnSync(
    process.execPath,
    [
        '--test',
        '--test-reporter=junit',
        'tests/unit/plannerLogic.test.js'
    ],
    { encoding: 'utf8' }
);

const xml = result.stdout || '';
fs.writeFileSync('unit-test-report.xml', xml);

const tests = [...xml.matchAll(
    /<testcase name="([^"]+)" time="([^"]+)"[^>]*>([\s\S]*?)<\/testcase>|<testcase name="([^"]+)" time="([^"]+)"[^>]*\/>/g
)];

const rows = tests.map((match) => {
    const name = match[1] || match[4];
    const time = match[2] || match[5];
    const failed = (match[3] || '').includes('<failure');

    return `<tr>
        <td>${name}</td>
        <td>${(Number(time) * 1000).toFixed(2)} ms</td>
        <td class="${failed ? 'fail' : 'pass'}">${failed ? 'FAILED' : 'PASSED'}</td>
    </tr>`;
}).join('');

const passed = (xml.match(/<!-- pass (\d+) -->/) || [])[1] || 0;
const failed = (xml.match(/<!-- fail (\d+) -->/) || [])[1] || 0;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Unit Testing Report</title>
<style>
body { font-family: Arial, sans-serif; margin: 30px; background: #f5f7fa; }
h1 { color: #222; }
.summary { background: white; padding: 20px; border-radius: 8px; }
table { width: 100%; border-collapse: collapse; background: white; margin-top: 20px; }
th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
th { background: #263747; color: white; }
.pass { color: green; font-weight: bold; }
.fail { color: red; font-weight: bold; }
</style>
</head>
<body>
<h1>AI-Based Smart Study Planner — Unit Test Report</h1>
<div class="summary">
<h2>Summary</h2>
<p>Total tests: ${Number(passed) + Number(failed)}</p>
<p class="pass">Passed: ${passed}</p>
<p class="fail">Failed: ${failed}</p>
</div>
<table>
<thead><tr><th>Test Name</th><th>Duration</th><th>Result</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;

fs.writeFileSync('unit-test-report.html', html);

console.log(`Passed: ${passed}, Failed: ${failed}`);
console.log('HTML report generated: unit-test-report.html');

process.exitCode = result.status ?? 1;