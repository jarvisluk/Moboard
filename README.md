# Moboard User Guide

Moboard is a cross-device voice dictation keyboard. Open the desktop app on your Mac, speak or type on your phone, and Moboard sends the text to the current cursor position on your Mac.

## Requirements

- A Mac running the Moboard desktop app.
- A phone with a modern browser that supports microphone and camera permissions.
- Internet access on both devices. Moboard uses a browser-based connection between the phone and desktop app.
- macOS Accessibility and Automation permissions may be required for automatic paste.

## Quick Start

1. Open Moboard on your Mac.
2. Wait for the desktop app to show `Active (Ready)` or a pairing screen.
3. On your phone, open:

   ```text
   https://moboard.pages.dev/
   ```

4. Scan the pairing code from the desktop app, or enter the 6-character Room Code shown on the Mac.
5. When the phone shows `Connected`, choose a recognition language and tap the microphone.
6. Dictated or typed text is sent to the Mac and pasted at the current cursor position.

## Security Notes

Treat the Moboard pairing screen as a remote-control credential.

The QR code is not a local-only shortcut. It contains pairing information that lets another browser connect to the desktop app over the internet while that session is active. Anyone who can see or obtain the QR code, Room Code, or pairing URL can connect from anywhere; the phone does not need to be physically near the Mac.

A connected device can send text, trigger Enter, and, when auto-paste is enabled, paste into whichever app currently has focus on your Mac.

To reduce risk:

- Do not share screenshots, livestreams, recordings, or support logs that show the QR code, pairing screen, Room Code, or pairing URL.
- Use `Refresh QR Code` immediately after a QR code or pairing code may have been exposed.
- Keep `Auto-Paste to Cursor` off if you only want to review incoming text in the desktop feed.
- Quit Moboard when you are not using it.
- Before sending sensitive text, confirm the active app and cursor location on your Mac.

## Use the Desktop App

The desktop app receives text from the phone and pastes it into the active Mac app.

- `Device Pairing` shows the pairing code and Room Code.
- `Refresh QR Code` creates a new pairing session. Use it when a connection fails or the old code may have been exposed.
- `Test Paste Automation` pastes a short test message at the current cursor so you can confirm macOS permissions.
- `Auto-Paste to Cursor` automatically pastes incoming text into the current cursor location. Turn it off to only receive text in the desktop feed.
- `Play Paste Sound` controls the notification sound when text is received.
- `Mobile App Deployment URL` points to the hosted phone client. Change it only if you deploy your own mobile client.

## Use the Phone

After connecting, the phone shows a text box, microphone button, language selector, and send button.

- Tap the microphone to start speech recognition. Tap it again to stop.
- When `Auto-Send on Speak` is on, finalized speech recognition text is sent to the Mac as you speak.
- Turn `Auto-Send on Speak` off if you want to review text before sending it with `Send to PC`.
- You can type directly in the text box. Press Enter to send the current text.
- If the text box is empty, pressing Enter sends an Enter key to the Mac.
- `Clear Text` clears the phone text box.
- The language selector supports Mandarin, English, Cantonese, and Japanese.

## macOS Permissions

If Moboard receives text but cannot paste automatically, macOS permissions are usually missing.

1. Click `Test Paste Automation` in the desktop app.
2. If macOS opens privacy settings, allow Moboard.
3. Check these locations:
   - `Privacy & Security` -> `Accessibility`
   - `Privacy & Security` -> `Automation`
4. Restart Moboard and run `Test Paste Automation` again.

If you started Moboard from a terminal, macOS may show the permission under Terminal, your shell app, or Electron instead of Moboard.

## Troubleshooting

### The phone cannot connect to the Mac

- Make sure Moboard is running on the Mac and the desktop app shows a pairing code or Room Code.
- Click `Refresh QR Code` on the desktop app, then try pairing again.
- If scanning fails, enter the 6-character Room Code manually.
- Confirm the phone browser can open `https://moboard.pages.dev/`.
- If the phone stays on a connecting state, refresh the phone page and try again.

### The phone cannot record audio

- Allow microphone access for `moboard.pages.dev`.
- If iPhone or Android prompts for microphone permission, choose allow.
- If the browser does not support web speech recognition, type into the text box and send manually.

### The scanner cannot read the pairing code

- Allow camera access in the phone browser.
- Hold the phone camera steady over the desktop pairing code for a few seconds.
- If the camera is unavailable, enter the 6-character Room Code manually.

### Text arrives but does not paste into the target app

- Click the target input field first so the cursor is active.
- Turn on `Auto-Paste to Cursor` in the desktop app.
- Click `Test Paste Automation` to check macOS Accessibility and Automation permissions.
- If permission still fails, Moboard may copy the text to the clipboard so you can paste manually with Command+V.

## Data and Limits

- Phone speech recognition depends on the browser Web Speech API. Availability and recognition quality depend on browser, operating system, and language.
- The phone and desktop app use an internet-accessible browser connection to pass text.
- Moboard temporarily uses the clipboard for automatic paste and attempts to restore the previous clipboard text after a successful paste.
- Automatic paste always targets the current cursor location. Check the active app before sending text.
