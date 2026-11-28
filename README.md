<div align="center">

# ♛ ChromaChess

**A modern Liquid Glass Chess web app with 3-level AI, real-time Game ID multiplayer, live WebRTC voice chat, and custom acoustic piece audio.**

[![Play Online](https://img.shields.io/badge/▶_Play_Online-chroma--chess.vercel.app-38BDF8?style=for-the-badge)](https://chroma-chess.vercel.app/)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![WebRTC](https://img.shields.io/badge/WebRTC-PeerJS-333333?style=for-the-badge&logo=webrtc&logoColor=white)
![Zero Backend](https://img.shields.io/badge/Backend-Zero%20Server-34D399?style=for-the-badge)

</div>

---

## ✨ Highlights

### 🤖 Single Player (`vs Computer`)
- **3 Difficulty Levels**:
  - **Easy** — Casual beginner play with light tactical awareness.
  - **Medium** — Curated **Opening Book** + Depth-2 Alpha-Beta search with Piece-Square Tables.
  - **Hard** — Curated **Opening Book** + Depth-3 Alpha-Beta search + **Quiescence Search** on captures.
- **Play As White or Black**: Choose your side before the first move; **Play As** and **Difficulty** lock once the game starts (click **New Game** to reset and switch).
- **Smart Undo**: Available in Computer mode (protects AI's opening White move when playing as Black).

### 🌐 2-Player Multiplayer (`Offline` & `Online`)
- **Offline (Same Device)**: Pass-and-play on a single screen.
- **Online (Cross-Device via Game ID)**:
  - Enter your **player name**, generate a 6-character **Game ID** (one-click copy), and share it with a friend.
  - Real-time peer-to-peer sync via **WebRTC (`PeerJS`)** — **no backend server required**.
  - **Live Voice Chat**: Built-in **Mic** & **Speaker** toggles over WebRTC *(requires HTTPS or `localhost`)*.
  - **Quick Reactions**: Send reactions (`Good move! 👏🏻`, `Nice! 👍`, `Okay, Wait a sec 😤`, `Hahahah 🤣`) with a 5-second cooldown.
  - **Match Controls**: **Offer Draw** (Accept/Decline banner) and **Resign** support.

### ⏱️ Time Controls & Rules
| Mode | Timer Options | Notes |
| :--- | :--- | :--- |
| **vs Computer** | `3m` · `5m` · `10m` · `Off` | Timer applies to the human player only |
| **2 Players** | `5m` · `10m` · `15m` · `Off` | Synced in real time in Online mode |

- **Timeout Tiebreak**: When a player's clock hits `00:00`, the player who lost the **fewest chess pieces** wins (or **Draw** if equal).
- **Full Chess Rules**: Castling (kingside & queenside), En Passant, Pawn Promotion (`Q / R / B / N`), Check, Checkmate, Stalemate, 50-Move Rule, Insufficient Material, and Threefold Repetition.

### 🎨 Liquid Glass UI, Audio & Responsiveness
- **Liquid Glass Design**: Frosted translucent panels with specular rims, animated ambient orbs, and **4 board themes** (**Neon Ocean**, **Sunset Coral**, **Emerald Forest**, **Royal Violet**).
- **3D Pieces & Animations**: 3D-shaded inline SVG pieces with smooth slide transitions between squares, captured pieces displayed under each player's name, and a **Checkmate confetti** celebration.
- **44.1kHz PCM-WAV Piece Audio**: Distinct carved-wood & felt-slide sound effects per piece (`P`, `N`, `B`, `R`, `Q`, `K`), captures, castling, check, and game over — played through HTML5 `<audio>` with a silent keep-alive loop for reliable **Bluetooth TWS earbud** playback.
- **Session Recovery**: Automatically saves and restores unfinished **AI**, **Offline**, and **Online** games (including auto-reconnecting to the same Game ID) on refresh via `sessionStorage`.
- **Responsive Mobile & Tablet Layout**: Dedicated right slide-out **Menu** drawer, compact in-game header, and full-width board/bar alignment across phones, tablets, and desktops.

---

## 📁 Project Structure

```text
chess/
├── .gitignore        # Git ignore rules
├── LICENSE           # Project license
├── README.md         # Project documentation
├── index.html        # App layout, modals, and mobile/tablet drawer
├── styles.css        # Liquid Glass styling, themes, and responsive breakpoints
└── js/
    ├── engine.js     # Complete chess rules engine & SAN generator
    ├── ai.js         # 3-level AI with opening book & quiescence search
    ├── online.js     # WebRTC (PeerJS) room sync & voice chat manager
    ├── pieces.js     # 3D-shaded inline SVG chess pieces
    ├── sound.js      # 44.1kHz PCM-WAV per-piece audio synthesizer
    └── app.js        # UI controller, timers, animations, and session recovery
```

---
