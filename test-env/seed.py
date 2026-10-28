#!/usr/bin/env python3
"""Load the nc-projects fixture lists into the TEST Nextcloud over CalDAV.

Every list and task here is made up. It mirrors the fixture table in SPEC.md
so each Must's check has something to run on. Safe to re-run: lists that
exist are kept and tasks are overwritten with the same content.

Refuses to run against anything but 127.0.0.1 / localhost, so it can never
write to the live server.
"""
import argparse
import base64
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

PASSWORDS = {u: f"{u}-test-only" for u in ("owner", "other", "agent")}
APPLE_EPOCH = datetime(2001, 1, 1, tzinfo=timezone.utc)

# The eight areas. URIs deliberately differ from display names (as on the
# live server), so code that matches by URI fails the checks.
AREAS = {
    "area-a-1": "Area A",
    "8d3c6c1e-5b0a-4c55-9a51-0c7e1f3b2a10": "Area B",
    "area-c": "Area C",
    "area-d-2": "Area D",
    "area-e": "Area E",
    "area-f": "Area F",
    "area-g": "Area G",
    "area-h": "Area H",
}

T0 = datetime(2026, 3, 1, 9, 0, tzinfo=timezone.utc)


def secs(dt):
    """Tasks' default sort order: seconds from 2001-01-01 to CREATED."""
    return int((dt - APPLE_EPOCH).total_seconds())


def stamp(dt):
    return dt.strftime("%Y%m%dT%H%M%SZ")


class Dav:
    def __init__(self, base, user):
        self.base = base.rstrip("/")
        self.user = user
        token = base64.b64encode(f"{user}:{PASSWORDS[user]}".encode()).decode()
        self.headers = {"Authorization": f"Basic {token}"}

    def req(self, method, path, body=None, headers=None, ok=(200, 201, 204, 207)):
        url = path if path.startswith("http") else self.base + path
        data = body.encode() if isinstance(body, str) else body
        r = urllib.request.Request(url, data=data, method=method,
                                   headers={**self.headers, **(headers or {})})
        try:
            with urllib.request.urlopen(r) as resp:
                return resp.status, resp.read().decode()
        except urllib.error.HTTPError as e:
            if e.code in ok:
                return e.code, e.read().decode()
            raise SystemExit(f"{method} {url} as {self.user}: HTTP {e.code}\n{e.read().decode()[:400]}")

    def cal_path(self, uri):
        return f"/remote.php/dav/calendars/{self.user}/{uri}/"

    def make_list(self, uri, name):
        body = f"""<?xml version="1.0" encoding="utf-8"?>
<c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
 <d:set><d:prop>
  <d:displayname>{name}</d:displayname>
  <c:supported-calendar-component-set><c:comp name="VTODO"/></c:supported-calendar-component-set>
 </d:prop></d:set>
</c:mkcalendar>"""
        code, _ = self.req("MKCALENDAR", self.cal_path(uri), body,
                           {"Content-Type": "application/xml; charset=utf-8"}, ok=(201, 405))
        print(f"   list {name!r} ({self.user}/{uri}): {'created' if code == 201 else 'already there'}")

    def share_with(self, uri, sharee):
        body = f"""<?xml version="1.0" encoding="utf-8"?>
<o:share xmlns:d="DAV:" xmlns:o="http://owncloud.org/ns">
 <o:set><d:href>principal:principals/users/{sharee}</d:href><o:read-write/></o:set>
</o:share>"""
        self.req("POST", self.cal_path(uri), body, {"Content-Type": "application/xml; charset=utf-8"})
        print(f"   shared {self.user}/{uri} with {sharee}")

    def put_task(self, uri, filename, ics):
        self.req("PUT", self.cal_path(uri) + filename, ics,
                 {"Content-Type": "text/calendar; charset=utf-8"})

    def list_uris(self):
        body = """<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>"""
        _, xml = self.req("PROPFIND", f"/remote.php/dav/calendars/{self.user}/", body,
                          {"Depth": "1", "Content-Type": "application/xml"})
        return xml


def vtodo(t):
    """One fixture dict -> iCalendar text (CRLF)."""
    created = t["created"]
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//nc-projects test fixtures//EN",
        "BEGIN:VTODO",
        f"UID:{t['uid']}",
        f"CREATED:{stamp(created)}",
        f"DTSTAMP:{stamp(created)}",
        f"LAST-MODIFIED:{stamp(created)}",
        f"SUMMARY:{t['summary']}",
    ]
    if t.get("categories"):
        lines.append("CATEGORIES:" + ",".join(t["categories"]))
    if t.get("parent"):
        lines.append(f"RELATED-TO:{t['parent']}")  # bare = PARENT (RFC 5545)
    if t.get("order") is not None:
        lines.append(f"X-APPLE-SORT-ORDER:{t['order']}")
    state = t.get("state", "open")
    if state == "done":
        done_at = created + timedelta(days=2)
        lines += ["STATUS:COMPLETED", f"COMPLETED:{stamp(done_at)}", "PERCENT-COMPLETE:100"]
    elif state == "cancelled":
        lines.append("STATUS:CANCELLED")
    else:
        lines.append("STATUS:NEEDS-ACTION")
    lines += t.get("extra", [])
    lines += ["END:VTODO", "END:VCALENDAR", ""]
    return "\r\n".join(lines)


def fixtures():
    """The fixture table from SPEC.md. Returns (user, list uri, task) tuples."""
    out = []
    n = [0]

    def add(user, cal, summary, *, uid=None, parent=None, cats=None, order=None,
            state="open", created=None, extra=None):
        n[0] += 1
        uid = uid or f"fx-{n[0]:03d}"
        out.append((user, cal, dict(uid=uid, summary=summary, parent=parent, categories=cats,
                                    order=order, state=state,
                                    created=created or T0 + timedelta(minutes=n[0]),
                                    extra=extra or [])))
        return uid

    P = ["project"]

    # 1. One ordered project per area, each with three ordered tasks (M1, M2, M10, M12).
    for i, (cal, name) in enumerate(AREAS.items()):
        base = secs(T0) + i * 1000
        proj = add("owner", cal, f"{name}: sample project", uid=f"area-{i}", cats=P, order=base)
        for k in range(3):
            add("owner", cal, f"{name}: task {k + 1}", parent=proj, order=base + 10 + k)

    # 2. A project with a child on another area's list (M3, M17).
    cross = add("owner", "area-c", "Cross-list project", uid="cross-proj", cats=P)
    add("owner", "area-d-2", "Child living on Area D", uid="cross-child", parent=cross)

    # 3. A four-level chain under a project (M3, M4): level 4 is "+1 deeper".
    chain = add("owner", "area-e", "Deep chain project", uid="chain-proj", cats=P)
    parent = chain
    for lvl in range(1, 5):
        parent = add("owner", "area-e", f"Chain level {lvl}", uid=f"chain-l{lvl}", parent=parent)

    # 4. 10 tasks across two levels, 4 completed, plus one cancelled (M5, M6).
    prog = add("owner", "area-f", "Progress project (4/10)", uid="prog-proj", cats=P)
    tops = []
    for k in range(5):
        tops.append(add("owner", "area-f", f"Progress top {k + 1}", parent=prog,
                        state="done" if k < 2 else "open"))
    for k in range(5):
        add("owner", "area-f", f"Progress sub {k + 1}", parent=tops[k % 2 + 2],
            state="done" if k < 2 else "open")
    add("owner", "area-f", "Progress cancelled", uid="prog-cancelled", parent=prog, state="cancelled")

    # 5. Blocked and someday projects (M7).
    add("owner", "area-g", "Blocked project", uid="blocked-proj", cats=P + ["blocked"])
    add("owner", "area-g", "Someday project", uid="someday-proj", cats=P + ["someday"])

    # 6. All tasks done, project still open (M8).
    full = add("owner", "area-h", "All done but open", uid="full-proj", cats=P)
    for k in range(3):
        add("owner", "area-h", f"Finished task {k + 1}", parent=full, state="done")

    # 7. Ordered tasks mixed with unordered ones: two newer, one older (M10, M11).
    mix_created = T0 + timedelta(days=30)
    mix = add("owner", "area-a-1", "Order mix project", uid="mix-proj", cats=P)
    for k in range(3):
        add("owner", "area-a-1", f"Ordered {k + 1}", uid=f"mix-ord-{k + 1}", parent=mix,
            order=secs(mix_created) + k, created=mix_created)
    add("owner", "area-a-1", "Unordered old", uid="mix-old", parent=mix,
        created=mix_created - timedelta(days=200))
    add("owner", "area-a-1", "Unordered new A", uid="mix-new-a", parent=mix,
        created=mix_created + timedelta(days=10))
    add("owner", "area-a-1", "Unordered new B", uid="mix-new-b", parent=mix,
        created=mix_created + timedelta(days=11))

    # 8. Agent fields and an unknown parameter, to prove round-trip (M15).
    agentp = add("owner", AREA_URI("Area B"), "Agent fields project", uid="agentf-proj", cats=P)
    add("owner", AREA_URI("Area B"), "Task with agent fields", uid="agentf-task", parent=agentp,
        extra=["X-CC-SOURCE:test-agent", "X-CC-TICKET;X-TEST-PARAM=keep:abc-123",
               "X-FORK-REF:fixture/fork-1", "DESCRIPTION;LANGUAGE=en:Keep every field."])

    # 9. Move source and target projects on different lists (M17).
    src = add("owner", "area-c", "Move source project", uid="move-src", cats=P)
    mover = add("owner", "area-c", "Task to move", uid="move-task", parent=src)
    add("owner", "area-c", "Subtask that moves with it", uid="move-sub", parent=mover)
    add("owner", "area-d-2", "Move target project", uid="move-dst", cats=P)

    # 10. An orphan and an untagged parent (M20).
    gone = add("owner", "area-h", "Closed parent", uid="orphan-parent", state="done")
    add("owner", "area-h", "Orphan task", uid="orphan", parent=gone)
    add("owner", "area-h", "Missing-parent orphan", uid="orphan-missing", parent="fx-does-not-exist")
    untag = add("owner", "area-h", "Untagged parent", uid="untagged")
    add("owner", "area-h", "Untagged child 1", parent=untag)
    add("owner", "area-h", "Untagged child 2", parent=untag)

    # 11. Lists Projects must ignore, each with a project task (M1, M2).
    add("other", "shared-list", "Project on a shared list", uid="ignore-shared", cats=P)
    add("agent", "queue", "Project on an agent queue", uid="ignore-queue", cats=P)
    return out


def AREA_URI(name):
    return next(u for u, n in AREAS.items() if n == name)


def deck_board(base):
    """Make one Deck board with a card as owner; Deck exposes it as an app-generated--deck--* list."""
    d = Dav(base, "owner")
    h = {"OCS-APIRequest": "true", "Content-Type": "application/json", "Accept": "application/json"}
    api = "/index.php/apps/deck/api/v1.0/boards"
    _, boards = d.req("GET", api, None, h)
    board = next((b for b in json.loads(boards) if b.get("title") == "Test board"), None)
    if not board:
        _, b = d.req("POST", api, json.dumps({"title": "Test board", "color": "0082c9"}), h)
        board = json.loads(b)
        _, s = d.req("POST", f"{api}/{board['id']}/stacks", json.dumps({"title": "To do", "order": 0}), h)
        stack = json.loads(s)
        d.req("POST", f"{api}/{board['id']}/stacks/{stack['id']}/cards",
              json.dumps({"title": "Card on a Deck board", "type": "plain", "order": 0}), h)
    print(f"   Deck board 'Test board' (id {board['id']})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8089")
    ap.add_argument("--deck", default="0")
    a = ap.parse_args()
    host = urllib.parse.urlparse(a.base).hostname
    if host not in ("127.0.0.1", "localhost"):
        sys.exit(f"Refusing to seed {host}: fixtures go only into the local test container.")

    owner, other, agent = Dav(a.base, "owner"), Dav(a.base, "other"), Dav(a.base, "agent")
    print("Lists:")
    for uri, name in AREAS.items():
        owner.make_list(uri, name)
    other.make_list("shared-list", "Shared by another person")
    other.share_with("shared-list", "owner")
    agent.make_list("queue", "Agent queue")
    agent.share_with("queue", "owner")
    if a.deck == "1":
        deck_board(a.base)

    print("Tasks:")
    who = {"owner": owner, "other": other, "agent": agent}
    tasks = fixtures()
    for user, cal, t in tasks:
        who[user].put_task(cal, f"f-{t['uid']}.ics", vtodo(t))
    print(f"   {len(tasks)} fixture tasks written")

    print("Owner can see:")
    xml = owner.list_uris()
    for uri in sorted(set(re.findall(r"/calendars/owner/([^/<]+)/<", xml))):
        print(f"   {uri}")


if __name__ == "__main__":
    main()
