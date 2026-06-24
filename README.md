# Wi-Fi Signal Live

A very small desktop app that shows the live Wi-Fi signal strength for the network your computer is already connected to.

The app is intentionally simple:

- Big live RSSI number in dBm
- Green when signal is strong, yellow when fair, red when weak
- Auto-refresh every 3 seconds
- Manual refresh button
- Band, channel, and last-updated time

## How It Works

You do not connect the app to Wi-Fi manually. It automatically reads the Wi-Fi network your computer is currently using.

To check another network, connect your computer to that Wi-Fi network in macOS or Windows, then reopen or refresh the app.

## Platform Support

| Platform | Status | Notes |
| --- | --- | --- |
| macOS | Supported | Uses CoreWLAN first for fast RSSI reads, with `system_profiler` fallback. |
| Windows | Basic support | Uses `netsh wlan show interfaces` and converts signal percent to approximate dBm. |
| Linux | Not supported yet | Needs a `nmcli` or `iw` reader. |

On macOS, the SSID can be hidden by privacy controls. When that happens the app shows `Connected Wi-Fi`, but the signal strength still works.

## Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Build everything:

```bash
npm run build
```

Run the CI-equivalent local check:

```bash
npm run check
```

## Project Structure

```txt
electron/
  main.ts        Native Wi-Fi signal readers and Electron window
  preload.cts    Secure bridge exposed to the renderer

src/
  main.ts        Renderer state and UI updates
  styles.css     App styling
```

## Signal Quality

| RSSI | Label |
| --- | --- |
| `-55 dBm` or better | Strong |
| `-56` to `-67 dBm` | Good |
| `-68` to `-75 dBm` | Fair |
| `-76` to `-85 dBm` | Weak |
| Worse than `-85 dBm` | Very weak |

## License

MIT
