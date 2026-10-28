# Installing My Flow (desktop)

| Your computer | Download |
|---|---|
| Mac with Apple Silicon (M1, M2, M3, M4…) | `MyFlow-1.0.0-mac-arm64.dmg` |
| Mac with Intel chip | `MyFlow-1.0.0-mac-x64.dmg` |
| Windows 10/11 (64-bit), install | `MyFlow-Setup-1.0.0-win-x64.exe` |
| Windows, no install (run from anywhere / USB) | `MyFlow-1.0.0-win-x64-portable.exe` |

Not sure which Mac you have? Apple menu → **About This Mac** → look at "Chip" (Apple M… = Apple Silicon) or "Processor" (Intel).

## macOS
1. Open the `.dmg` and drag **My Flow** onto **Applications**.
2. First launch only: the app isn't notarized by Apple yet, so macOS blocks a normal double-click. Open **Applications**, **right-click My Flow → Open**, then click **Open** again.
   - On recent macOS versions, if there's no Open button, go to **System Settings → Privacy & Security** and click **Open Anyway** next to My Flow.
   - If macOS says the app "is damaged", run this once in Terminal, then open it normally:
     `xattr -dr com.apple.quarantine "/Applications/My Flow.app"`

## Windows
1. Run `MyFlow-Setup-1.0.0-win-x64.exe`. Because the installer isn't code-signed yet, SmartScreen may say "Windows protected your PC". Click **More info → Run anyway**.
2. Choose the install folder. Desktop and Start-menu shortcuts are created.
   The portable `.exe` needs no install. Double-click it to run.

## Notes
- No account needed. Files are saved inside the app on your computer (each desktop app keeps its own library, separate from the browser version). Use **File → Save local copy** to back up a file, and **Import** on the home screen to open it elsewhere.
- AI features: open the agent (⌘J / Ctrl+J) and add your Claude, ChatGPT or Gemini API key.
- An internet connection is needed for Google Fonts, stock photos and AI. Everything else works offline.

## Building the installers yourself
```bash
npm install
npm run dist:mac      # both Mac DMGs (Intel + Apple Silicon)
npm run dist:win      # Windows installer + portable .exe
npm run test:desktop  # end-to-end test of the packaged Mac app
```
Output goes to `release/`. For public distribution without the first-launch warnings, sign with an Apple Developer ID (and notarize) and a Windows code-signing certificate. electron-builder picks them up via `CSC_LINK` / `CSC_KEY_PASSWORD`, plus `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` for notarization.
