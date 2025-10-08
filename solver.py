# solver.py
# Sudoku Solver using CSP + Backtracking with MRV + Forward Checking

def is_valid(board, r, c, val):
    # Check row
    if val in board[r]:
        return False
    # Check column
    for i in range(9):
        if board[i][c] == val:
            return False
    # Check 3x3 block
    start_r, start_c = (r // 3) * 3, (c // 3) * 3
    for i in range(start_r, start_r + 3):
        for j in range(start_c, start_c + 3):
            if board[i][j] == val:
                return False
    return True


def get_domain(board, r, c):
    """Get possible valid numbers for a cell."""
    if board[r][c] != 0:
        return []
    return [v for v in range(1, 10) if is_valid(board, r, c, v)]


def find_mrv(board):
    """Minimum Remaining Values heuristic."""
    best = None
    min_domain = 10
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0:
                domain = get_domain(board, r, c)
                if len(domain) == 0:
                    return (r, c, [])
                if len(domain) < min_domain:
                    best = (r, c, domain)
                    min_domain = len(domain)
    return best


def forward_check(board):
    """Ensure all empty cells still have at least one valid value."""
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0 and len(get_domain(board, r, c)) == 0:
                return False
    return True


def solve_sudoku(board):
    """Recursive CSP + backtracking solver."""
    mrv = find_mrv(board)
    if not mrv:
        return True  # Solved
    r, c, domain = mrv
    if len(domain) == 0:
        return False

    for val in domain:
        if is_valid(board, r, c, val):
            board[r][c] = val
            if forward_check(board):
                if solve_sudoku(board):
                    return True
            board[r][c] = 0  # Backtrack
    return False


def solve(board):
    """Entry point: returns solved board or raises ValueError."""
    from copy import deepcopy
    puzzle = deepcopy(board)
    if not solve_sudoku(puzzle):
        raise ValueError("No valid Sudoku solution found")
    return puzzle