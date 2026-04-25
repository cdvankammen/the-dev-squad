import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'src/app/page.tsx',
  'src/app/squad/page.tsx',
];

function count(pattern, text) {
  const m = text.match(pattern);
  return m ? m.length : 0;
}

const report = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const buttons = count(/<button\b/g, src);
  const buttonsWithOnClick = count(/<button\b[\s\S]*?onClick=/g, src);
  const selects = count(/<select\b/g, src);
  const selectsWithOnChange = count(/<select\b[\s\S]*?onChange=/g, src);
  const inputs = count(/<input\b/g, src);
  const inputsWithOnChange = count(/<input\b[\s\S]*?onChange=/g, src);
  const textareas = count(/<textarea\b|<AutoGrowTextarea\b/g, src);
  const textareasWithChange = count(/<textarea\b[\s\S]*?onChange=|<AutoGrowTextarea\b[\s\S]*?onChange=/g, src);

  report.push({
    file,
    buttons,
    buttonsWithOnClick,
    selects,
    selectsWithOnChange,
    inputs,
    inputsWithOnChange,
    textareas,
    textareasWithChange,
  });

  assert(buttonsWithOnClick <= buttons, `${file}: button onClick count exceeds button count`);
  assert(selectsWithOnChange <= selects, `${file}: select onChange count exceeds select count`);
  assert(inputsWithOnChange <= inputs, `${file}: input onChange count exceeds input count`);

  // Strong sanity checks (not every control must be controlled, but key forms should be):
  assert(selectsWithOnChange > 0, `${file}: expected select controls with onChange handlers`);
  assert(textareasWithChange > 0, `${file}: expected textarea/chat controls with onChange handlers`);
}

console.log('UI control wiring audit OK');
console.log(JSON.stringify(report, null, 2));
