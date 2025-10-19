# Libraries imported
from flask import Flask, render_template, request, jsonify
from copy import deepcopy
from solver import solve
import os

# Creates the flask instance.
app = Flask(__name__, static_folder='static', template_folder='templates')

# It checks that a valid number can be entered at r,c.
def is_valid(board, r, c, val):
    for j in range(9):
        if board[r][j] == val:
            return False
    for i in range(9):
        if board[i][c] == val:
            return False
    br = (r // 3) * 3
    bc = (c // 3) * 3
    for i in range(br, br + 3):
        for j in range(bc, bc + 3):
            if board[i][j] == val:
                return False
    return True

# Finds empty cell and returns the location or none if the borad is full.
def find_empty(board):
    for i in range(9):
        for j in range(9):
            if board[i][j] == 0:
                return i, j
    return None

# This is a simple backtracking.
def solve_backtracking(board):
    empty = find_empty(board)
    if not empty:
        return True
    r, c = empty
    for val in range(1, 10):
        if is_valid(board, r, c, val):
            board[r][c] = val
            if solve_backtracking(board):
                return True
            board[r][c] = 0
    return False

# ROUTES
# This is the front-end.
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/solve', methods=['POST'])
def solve_api():
    data = request.get_json()
    board = data.get('board', [])
    if not board or len(board) != 9:
        return jsonify({'error': 'invalid board'}), 400
    try:
        board_copy = deepcopy(board)
        solution = solve(board_copy)   # calling CSP, backtracking solver.
        return jsonify({'solution': solution}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
