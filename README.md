# Departures

A personal link board styled like an airport departure board. Every link is a "gate":
press its number key to open it, or start typing to search.

**Edit `config.js` to change the links.** You don't need to touch any other file.

| Status in config | Meaning |
|---|---|
| `ON TIME` | Live |
| `BOARDING` | In progress |
| `DELAYED` | Paused |
| `LANDED` | Finished / archived |

Set `url: "#"` for a link that isn't ready yet. The row still shows, but it can't be clicked.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
