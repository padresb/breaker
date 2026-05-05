from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


HOST = ""
PORT = 4173
DEV_SHORTCUTS = (
    "Ctrl+Shift+1-9: jump to wave 1-9",
    "Ctrl+Shift+0: jump to wave 10",
    "Ctrl+L: add 1 life",
)


def print_dev_shortcuts():
    print("Developer shortcuts:")
    for shortcut in DEV_SHORTCUTS:
        print(f"- {shortcut}")


def main():
    print_dev_shortcuts()
    server = ThreadingHTTPServer((HOST, PORT), SimpleHTTPRequestHandler)
    print(f"Serving Neon Siege Breaker at http://localhost:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
