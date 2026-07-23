import os
import sys
import imaplib
import email
from datetime import date, timedelta
from email.utils import parsedate
from time import mktime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LAST_FETCH_PATH = REPO_ROOT / "src/assets/last_email_fetch.txt"
MAX_EMAILS = 1200


def should_clean_today():
    if not LAST_FETCH_PATH.exists():
        return False
    last_fetch = date.fromisoformat(LAST_FETCH_PATH.read_text().strip())
    next_fetch = last_fetch + timedelta(days=30)
    return date.today() == next_fetch - timedelta(days=1)


def main():
    if not should_clean_today():
        print("Not the cleaning day. Skipping.")
        return

    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")

    if not user or not password:
        print("Error: GMAIL_USER or GMAIL_APP_PASSWORD not set.")
        sys.exit(1)

    print("Connecting to Gmail for cleanup...")
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
        print(f"Found {len(email_ids)} unread emails. Scanning headers...")

    sender_latest = {}
    processed = 0

    for eid in email_ids:
        status, msg_data = mail.fetch(eid, "(BODY.PEEK[HEADER])")
        if status != "OK":
            continue
        header_bytes = msg_data[0][1]
        msg = email.message_from_bytes(header_bytes)
        sender = msg.get("From", "unknown")
        date_str = msg.get("Date")
        ts = mktime(parsedate(date_str)) if date_str else 0

        if sender not in sender_latest or ts > sender_latest[sender][0]:
            if sender in sender_latest:
                try:
                    mail.store(sender_latest[sender][1], "+FLAGS", "\\Seen")
                except:
                    pass
            sender_latest[sender] = (ts, eid)
        else:
            try:
                mail.store(eid, "+FLAGS", "\\Seen")
            except:
                pass

        processed += 1
        if processed % 100 == 0:
            print(f"  Processed {processed}/{len(email_ids)}...")

    print(f"Cleanup done. Kept {len(sender_latest)} emails UNSEEN.")
    mail.logout()


if __name__ == "__main__":
    main()