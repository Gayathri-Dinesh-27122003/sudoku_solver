# Suduko solver
# Algorithm used are CSP, Backtracking with MRV and Forward checking

# Checks that the value is valid at r,c.
def is_valid(board, r, c, val):
    # Checking row
    if val in board[r]:
        return False
    # Checking column
    for i in range(9):
        if board[i][c] == val:
            return False
    # Checking 3x3 block
    start_r, start_c = (r // 3) * 3, (c // 3) * 3
    for i in range(start_r, start_r + 3):
        for j in range(start_c, start_c + 3):
            if board[i][j] == val:
                return False
    return True
    # Returns true if nothing fails.

# Returns the list of valid numbers that can be placed at r,c.
def get_domain(board, r, c):
    if board[r][c] != 0:
        return []
    return [v for v in range(1, 10) if is_valid(board, r, c, v)]

# Implementation of MRV.
# It finds next empty cell with less number of possible valid number.
def find_mrv(board):
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
    # If there is no possible valid number then it is deadend , backtracking will start.

# Implementation of Forward Checking.
# It places the number then ensures that there is no empty cell left with no valid number.
def forward_check(board):
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0 and len(get_domain(board, r, c)) == 0:
                return False
    return True

# Implementation of recursive CSP and Backtracking.
def solve_sudoku(board):
    mrv = find_mrv(board)
    if not mrv:
        return True  # If there is no empty cell then the suduko is solved.
    r, c, domain = mrv
    if len(domain) == 0:
        return False

    for val in domain:
        if is_valid(board, r, c, val):
            board[r][c] = val
            if forward_check(board):
                if solve_sudoku(board):
                    return True
            board[r][c] = 0  # Backtracking
    return False
    # It returns true if there is solved.

# It returns a solved suduko.
# If there is no soluttion found then it raises an error.
def solve(board):
    from copy import deepcopy
    puzzle = deepcopy(board)
    # Validate the initial board for shape, value ranges and duplicates
    def validate_board(b):
        # Check shape
        if not isinstance(b, list) or len(b) != 9:
            raise ValueError('Board must be a 9x9 list')
        for r in range(9):
            if not isinstance(b[r], list) or len(b[r]) != 9:
                raise ValueError('Board must be a 9x9 list')
        # Check values and duplicates
        for r in range(9):
            for c in range(9):
                val = b[r][c]
                if not isinstance(val, int) or val < 0 or val > 9:
                    raise ValueError(f'Invalid cell value at ({r},{c}): {val}')
                if val != 0:
                    # Temporarily clear the cell and check validity
                    b[r][c] = 0
                    try:
                        if not is_valid(b, r, c, val):
                            raise ValueError(f'Invalid board: duplicate value {val} at ({r},{c})')
                    finally:
                        b[r][c] = val

    validate_board(puzzle)

    if not solve_sudoku(puzzle):
        raise ValueError("No valid Sudoku solution found")
    return puzzle
