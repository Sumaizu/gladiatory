// тесты без браузера: node tools/test.mjs [часть названия]
import '../tests/js/engine.test.js';
import { run } from '../tests/js/harness.js';

const result = await run(process.argv[2] || '');
for (const failure of result.failed) console.log('УПАЛ: ' + failure.name + '\n    ' + failure.error.replace(/\n/g, '\n    '));
console.log('тестов: ' + result.total + ', прошло: ' + result.passed + ', упало: ' + result.failed.length);
process.exit(result.failed.length || !result.total ? 1 : 0);
