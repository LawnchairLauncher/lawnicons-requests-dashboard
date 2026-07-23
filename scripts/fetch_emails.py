"""
Fetch unread emails from Gmail via IMAP and save as .eml files.
Inbox is assumed pre-cleaned by clean_emails.py.
"""

import os
import sys
import imaplib
from datetime import date, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
EMAILS_DIR = REPO_ROOT / "emails"
LAST_FETCH_PATH = REPO_ROOT / "src/assets/last_email_fetch.txt"
MAX_EMAILS = 300


def should_fetch_today():
    today = date.today()
    if LAST_FETCH_PATH.exists():
        last = date.fromisoformat(LAST_FETCH_PATH.read_text().strip())
        return today >= last + timedelta(days=30)
    return True


def main():
    if not should_fetch_today():
        print("Not the fetch day. Skipping email fetch.")
        return

    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")

    if not user or not password:
        print("Error: GMAIL_USER or GMAIL_APP_PASSWORD not set.")
        sys.exit(1)

    print("Connecting to Gmail...")
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(user, password)
    mail.select("inbox")

    status, messages = mail.search(None, "UNSEEN")
    if status != "OK" or not messages[0]:
        print("No unread emails.")
        mail.logout()
        return

    email_ids = messages[0].split()
    if len(email_ids) > MAX_EMAILS:
        print(f"Limiting to {MAX_EMAILS} emails ({len(email_ids)} total)")
        email_ids = email_ids[:MAX_EMAILS]
    else:
        print(f"Found {len(email_ids)} unread emails.")

    EMAILS_DIR.mkdir(parents=True, exist_ok=True)
    saved = 0

    for eid in email_ids:
        status, msg_data = mail.fetch(eid, "(RFC822)")
        if status != "OK":
            continue
        raw_email = msg_data[0][1]

        filename = f"{eid.decode()}.eml"
        filepath = EMAILS_DIR / filename

        with open(filepath, "wb") as f:
            f.write(raw_email)

        try:
            mail.store(eid, "+FLAGS", "\\Seen")
        except Exception as e:
            print(f"Warning: failed to mark as seen: {e}")
        saved += 1

    mail.logout()
    print(f"Done. Saved {saved} emails to {EMAILS_DIR}.")
    LAST_FETCH_PATH.parent.mkdir(parents=True, exist_ok=True)
    LAST_FETCH_PATH.write_text(date.today().isoformat())


if __name__ == "__main__":
    main()