// 명령줄 옵션: Node 내장 util.parseArgs. 스크립트마다 옵션 이름과 형식을 적어 두면
// 오타·값 빠뜨림이 조용히 무시되지 않고 오류로 드러난다.
//   const { opt, flag, positionals } = require('./args.js')({ step: 'string', quiet: 'boolean' });
//   opt('step', 'S00'), flag('quiet'), positionals[0]
const { parseArgs } = require('node:util');

module.exports = function args(spec, argv = process.argv.slice(2)) {
  const options = Object.fromEntries(Object.entries(spec).map(([k, type]) => [k, { type }]));
  const { values, positionals } = parseArgs({ args: argv, options, allowPositionals: true, strict: true });
  return {
    values,
    positionals,
    opt: (k, d) => (values[k] !== undefined ? values[k] : d),
    flag: k => !!values[k],
  };
};
