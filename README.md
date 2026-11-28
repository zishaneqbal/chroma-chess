# ChromaChess

A Chess web application built with **HTML, CSS, and JavaScript** featuring Single Player AI (3 difficulty levels) and 2-Player Offline & Online Real-Time Multiplayer.

# Quick play
- [Link](https://chroma-chess.vercel.app/)

## Features

- **Single Player (vs Computer)**:
  - **Easy**, **Medium**, and **Hard** difficulty levels powered by Minimax + Alpha-Beta pruning, Piece-Square Tables, a curated **Opening Book** (Medium/Hard), and **Quiescence Search** (Hard).
  - Difficulty is locked once the first move is played (click **New Game** to change it).
  - Choose to play as **White** or **Black**, with **Undo** support.
- **2-Player Multiplayer**:
  - **Offline (Same Device)**: Pass-and-play on one screen.
  - **Online (Different Devices)**: Enter your **player name**, create a **Game ID** (with one-click copy), and share it with a friend to connect and sync moves, names, clocks, and rematches in real time via WebRTC (`PeerJS`) — no backend server required.
  - **Live Voice Chat (Online Mode)**: Built-in WebRTC **Mic** and **Speaker** toggle buttons to talk with your opponent while playing (requires HTTPS or `localhost`).
  - **Quick Reactions & Match Controls (Online Mode)**: Send quick-reaction pills (`Good move! 👏🏻`, `Nice! 👍`, `Okay, Wait a sec 😤`, `Hahahah 🤣`), **Offer Draw** (Accept/Decline), or **Resign**.
  - Undo is hidden in 2-Player modes.
- **Selectable Time Controls**:
  - **vs Computer**: **3m**, **5m**, **10m**, or **Off** (timer applies to the human player only).
  - **2 Players**: **5m**, **10m**, **15m**, or **Off** (synced in real time in Online mode).
  - Timer is locked once the game begins; if a player's clock expires, the player who lost the **fewest chess pieces** wins (or **Draw** if equal).
- **Complete Chess Rules**:
  - Castling (kingside & queenside), En Passant, Pawn Promotion (Queen, Rook, Bishop, Knight), Check, Checkmate, Stalemate, 50-move rule, Insufficient Material, and Threefold Repetition, with clear draw-reason descriptions.
- **Liquid Glass UI, Animations & Cross-Device Support**:
  - Translucent **Liquid Glass** styling with animated ambient glow orbs and 4 selectable board themes (**Neon Ocean**, **Sunset Coral**, **Emerald Forest**, **Royal Violet**).
  - 3D-shaded inline SVG chess pieces with smooth slide animations between squares, crisp inline SVG UI icons, click-to-move & drag-and-drop, Checkmate confetti animation, move history in Standard Algebraic Notation (SAN), captured pieces with material advantage, board flip, and distinct Web Audio sound effects per chess piece.
  - Automatic `sessionStorage` recovery for unfinished AI, Offline, and Online games (auto-reconnecting to the same Game ID and syncing board state on refresh).
  - Fully responsive layout that scales smoothly across **desktops, laptops, tablets, and mobile phones** (portrait and landscape) with touch-optimized controls.

## Project Structure

```text
chess/
├── .gitignore        # Git ignore rules
├── index.html        # App layout and modals
├── styles.css        # Liquid Glass styling, themes, and responsive breakpoints
├── README.md         # Documentation
└── js/
    ├── engine.js     # Complete chess rules engine
    ├── ai.js         # 3-level AI with opening book & quiescence search
    ├── online.js     # WebRTC (PeerJS) real-time room & voice chat sync
    ├── pieces.js     # 3D-shaded inline SVG chess pieces
    ├── sound.js      # Piece-specific Web Audio API sound effects
    └── app.js        # UI controller, timers, animations, and session recovery
```
