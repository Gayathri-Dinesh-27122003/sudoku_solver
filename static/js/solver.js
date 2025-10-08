// Dual-mode Sudoku Solver (Client visualization + Server solver)

const gridEl = document.getElementById('grid');
const speedRange = document.getElementById('speed');
const speedVal = document.getElementById('speed-val');
const visualizeBtn = document.getElementById('visualizeBtn');
const serverSolveBtn = document.getElementById('serverSolveBtn');
const resetBtn = document.getElementById('resetBtn');
const clearBtn = document.getElementById('clearBtn');
const stopBtn = document.getElementById('stopBtn');
const playBtn = document.getElementById('playBtn');

let cells = [];
let original = [];
let steps = [];
let running = false;
let stopped = false;
let stepIndex = 0;

// BUILD GRID
function buildGrid() {
  gridEl.innerHTML = '';
  cells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'sudoku-cell';
      if (c % 3 === 2 && c !== 8) cell.classList.add('block-right');
      if (r % 3 === 2 && r !== 8) cell.classList.add('block-bottom');
      if (c === 0) cell.classList.add('block-left');
      if (r === 0) cell.classList.add('block-top');

      const input = document.createElement('input');
      input.setAttribute('maxlength', '1');
      input.setAttribute('inputmode', 'numeric');
      input.dataset.r = r;
      input.dataset.c = c;
      input.addEventListener('input', onCellInput);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' || e.key === 'Delete') input.value = '';
      });

      cell.appendChild(input);
      gridEl.appendChild(cell);
      cells.push(input);
    }
  }
}

function onCellInput(e) {
  const v = e.target.value.trim();
  if (v === '') return;
  if (!/^[1-9]$/.test(v)) e.target.value = '';
}

// BOARD UTILITIES
function readBoard() {
  const board = [];
  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 9; c++) {
      const val = cells[r * 9 + c].value.trim();
      row.push(val === '' ? 0 : parseInt(val));
    }
    board.push(row);
  }
  return board;
}

function setBoard(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const el = cells[r * 9 + c];
      el.value = board[r][c] === 0 ? '' : board[r][c];
    }
  }
}

function snapshotOriginal() {
  original = readBoard().map(r => r.slice());
}

function resetToOriginal() {
  // restore original question (not clear everything)
  setBoard(original);
}

function clearBoard() {
  setBoard(Array.from({ length: 9 }, () => Array(9).fill(0)));
  snapshotOriginal();
}

// ========== CLIENT-SIDE VISUAL SOLVER (CSP + BACKTRACKING) ==========

function valid(board, r, c, val) {
  for (let j = 0; j < 9; j++) if (board[r][j] === val) return false;
  for (let i = 0; i < 9; i++) if (board[i][c] === val) return false;
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let i = br; i < br + 3; i++)
    for (let j = bc; j < bc + 3; j++)
      if (board[i][j] === val) return false;
  return true;
}

function getDomain(board, r, c) {
  if (board[r][c] !== 0) return [];
  const dom = [];
  for (let v = 1; v <= 9; v++) if (valid(board, r, c, v)) dom.push(v);
  return dom;
}

function findMRV(board) {
  let best = null;
  let bestLen = 10;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const dom = getDomain(board, r, c);
        if (dom.length === 0) return { r, c, dom: [] };
        if (dom.length < bestLen) { bestLen = dom.length; best = { r, c, dom }; }
      }
    }
  }
  return best;
}

function pushStep(step) { steps.push(step); }

function visualizeSteps(startIndex = 0) {
  stepIndex = startIndex;
  running = true;
  stopped = false;

  function tick() {
    if (stopped || stepIndex >= steps.length) {
      running = false;
      return;
    }
    const s = steps[stepIndex++];
    const el = cells[s.r * 9 + s.c];

    cells.forEach(inp => inp.classList.remove('cell-trying', 'cell-assigned', 'cell-conflict'));

    if (s.type === 'try') {
      el.classList.add('cell-trying');
      el.value = s.val;
    } else if (s.type === 'assign') {
      el.classList.add('cell-assigned');
      el.value = s.val;
    } else if (s.type === 'unassign') {
      el.classList.add('cell-conflict');
      el.value = '';
    }

    const delay = parseInt(speedRange.value, 10);
    setTimeout(tick, delay);
  }
  tick();
}

function solveCSP(board) {
  const empty = findMRV(board);
  if (!empty) return true;
  const { r, c, dom } = empty;
  if (dom.length === 0) return false;
  for (const v of dom) {
    pushStep({ type: 'try', r, c, val: v });
    board[r][c] = v;
    let ok = true;
    for (let i = 0; i < 9 && ok; i++) {
      for (let j = 0; j < 9; j++) {
        if (board[i][j] === 0 && getDomain(board, i, j).length === 0) {
          ok = false; break;
        }
      }
    }
    if (ok) {
      pushStep({ type: 'assign', r, c, val: v });
      if (solveCSP(board)) return true;
    }
    pushStep({ type: 'unassign', r, c, val: v });
    board[r][c] = 0;
  }
  return false;
}

// ========== EVENT HANDLERS ==========

// Visual Solve button
visualizeBtn.addEventListener('click', () => {
  if (running) return;
  steps = [];
  const board = readBoard();
  snapshotOriginal();
  const copy = board.map(r => r.slice());
  const ok = solveCSP(copy);
  if (!ok) { alert('No solution found (visualizer).'); return; }
  visualizeSteps(0);
});

// Server Solve button
serverSolveBtn.addEventListener('click', async () => {
  if (running) return;
  const board = readBoard();
  try {
    const res = await fetch('/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Server failed to solve'); return; }
    setBoard(data.solution);
    snapshotOriginal();
  } catch (e) {
    alert('Server error: ' + e.message);
  }
});

// Stop/Play buttons
stopBtn.addEventListener('click', () => {
  if (running) { stopped = true; running = false; }
});
playBtn.addEventListener('click', () => {
  if (!running && stopped && stepIndex < steps.length) {
    visualizeSteps(stepIndex);
  }
});

// Reset and Clear
resetBtn.addEventListener('click', () => {
  if (running) return;
  resetToOriginal(); // ✅ fix: restores question, not blank grid
});
clearBtn.addEventListener('click', () => {
  if (running) return;
  clearBoard(); // clears everything intentionally
});

// Speed display
speedRange.addEventListener('input', () => {
  speedVal.textContent = speedRange.value;
});

// Initialize
buildGrid();
snapshotOriginal();
