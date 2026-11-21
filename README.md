[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/qienzdork/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/qienzdork/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

# csv-reader-speed

A fast drop-in replacement for make.fun's own csv-reader 1.0.0. `solve.js`
exports `run(input)`, which reads one CSV input `{text, header}` and
returns `{columns, rows, errors}` with exactly csv-reader 1.0.0's
broken-row policy (BOM dropped, CRLF and lone CR inside quotes read as
LF, stray CRs dropped with an error, quote junk and unterminated quotes
reported, short and long rows padded or cut to the first record's width).

Instead of walking the text character by character, the parser jumps
between delimiters with `indexOf` and slices whole fields at once; a
record whose line holds no quote and no stray CR is split in one go.
`main.ts` is the harness driver: it reads every case from
`/input/cases.json`, answers each with `run`, and writes
`/output/answers.json`.

Entry for the make.fun bounty
[csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121):
read broken CSV files faster.
