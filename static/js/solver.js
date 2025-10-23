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

// Client-side validation for logical duplicates and value ranges
function validateBoard(board) {
  if (!Array.isArray(board) || board.length !== 9) return 'Board must be 9x9';
  for (let r = 0; r < 9; r++) {
    if (!Array.isArray(board[r]) || board[r].length !== 9) return 'Board must be 9x9';
    for (let c = 0; c < 9; c++) {
      const val = board[r][c];
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 0 || val > 9) {
        return { message: `Invalid value at (${r + 1},${c + 1}): ${val}`, cells: [[r, c]] };
      }
      if (val !== 0) {
        // check row
        for (let j = 0; j < 9; j++) if (j !== c && board[r][j] === val) return { message: `Duplicate value ${val} in row ${r + 1}`, cells: [[r, c], [r, j]] };
        // check column
        for (let i = 0; i < 9; i++) if (i !== r && board[i][c] === val) return { message: `Duplicate value ${val} in column ${c + 1}`, cells: [[r, c], [i, c]] };
        // check box
        const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
        for (let i = br; i < br + 3; i++) {
          for (let j = bc; j < bc + 3; j++) {
            if ((i !== r || j !== c) && board[i][j] === val) return { message: `Duplicate value ${val} in 3x3 block starting at (${br + 1},${bc + 1})`, cells: [[r, c], [i, j]] };
          }
        }
      }
    }
  }
  return null;
}

function clearCellStates() {
  // remove any visual state classes from all cells
  cells.forEach((el) => el.classList.remove('cell-conflict', 'cell-assigned', 'cell-trying'));
}

function highlightCells(coords) {
  clearCellStates();
  coords.forEach(([r, c]) => {
    const el = cells[r * 9 + c];
    if (el) el.classList.add('cell-conflict');
  });
}

function showErrorInline(message, coords) {
  const container = document.getElementById('errorContainer');
  const text = document.getElementById('errorText');
  if (container && text) {
    text.textContent = message;
    container.style.display = 'block';
  } else {
    alert(message);
  }
  if (coords && coords.length) highlightCells(coords);
}

function clearErrorInline() {
  const container = document.getElementById('errorContainer');
  const text = document.getElementById('errorText');
  if (container && text) {
    text.textContent = '';
    container.style.display = 'none';
  }
  clearCellStates();
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
  // client-side validate before attempting to visualize
  clearErrorInline();
  const err = validateBoard(board);
  if (err) {
    const msg = typeof err === 'string' ? err : err.message;
    const coords = err.cells || [];
  showErrorInline(msg, coords);
    return;
  }
  const copy = board.map(r => r.slice());
  const ok = solveCSP(copy);

  if (!ok) {
  alert('No valid Sudoku solution exists!');
    clearBoard(); // Clear after user closes alert
    return;
  }

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

  // Always check if the backend failed or Sudoku unsolvable
    if (!res.ok || data.error) {
      const msg = data && data.error ? data.error : 'No valid Sudoku solution exists!';
      // show inline error and highlight not attempted cells (server may not provide coords)
  showErrorInline(msg, []);
      return;
    }

    // clear previous errors/highlights on success
    clearErrorInline();

  // Set solved board
    setBoard(data.solution);
    snapshotOriginal();
  } catch (e) {
  // Even if Flask crashes or server not running
  alert('No valid Sudoku solution exists!');
    clearBoard();
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
  resetToOriginal(); // fix: restores question, not blank grid
  clearErrorInline();
  clearCellStates();
});
clearBtn.addEventListener('click', () => {
  if (running) return;
  clearBoard(); // clears everything intentionally
  clearErrorInline();
  clearCellStates();
});

// Speed display
speedRange.addEventListener('input', () => {
  speedVal.textContent = speedRange.value;
});

// Initialize
buildGrid();
snapshotOriginal();
