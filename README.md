# ChromaChess

A Chess web application built with **HTML, CSS, and JavaScript** featuring Single Player AI (3 difficulty levels) and 2-Player Offline & Online Real-Time Multiplayer.

## Features

- **Single Player (vs Computer)**:
  - **Easy**, **Medium**, and **Hard** difficulty levels powered by Minimax + Alpha-Beta pruning and Piece-Square Tables.
  - Difficulty is locked once the first move is played (click **New Game** to change it).
  - Choose to play as **White** or **Black**.
- **2-Player Multiplayer**:
  - **Offline (Same Device)**: Pass-and-play on one screen.
  - **Online (Different Devices)**: Create a **Game ID** and share it with a friend to connect and sync moves in real time via WebRTC (`PeerJS`) — no backend server required.
- **Complete Chess Rules**:
  - Castling (kingside & queenside), En Passant, Pawn Promotion (Queen, Rook, Bishop, Knight), Check, Checkmate, Stalemate, 50-move rule, Insufficient Material, and Threefold Repetition.
- **Modern Colorful UI & Cross-Device Support**:
  - 4 selectable board themes (**Neon Ocean**, **Sunset Coral**, **Emerald Forest**, **Royal Violet**).
  - Crisp inline SVG pieces and UI icons, click-to-move & drag-and-drop, move history in Standard Algebraic Notation (SAN), captured pieces with material advantage, board flip, undo (offline/AI), and Web Audio sound effects.
  - Fully responsive layout that scales smoothly across **desktops, laptops, tablets, and mobile phones** (both portrait and landscape) with touch-optimized controls.

## Project Structure

```text
chess/
├── .gitignore        # Git ignore rules
├── index.html        # App layout and modals
├── styles.css        # Glassmorphic styling, themes, and responsive breakpoints
├── README.md         # Documentation & GitHub deployment guide
└── js/
    ├── engine.js     # Complete chess rules engine
    ├── ai.js         # 3-level computer AI
    ├── online.js     # WebRTC (PeerJS) real-time room sync
    ├── pieces.js     # Inline SVG chess pieces
    ├── sound.js      # Web Audio API sound effects
    └── app.js        # UI controller
```

