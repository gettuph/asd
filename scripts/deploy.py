#!/usr/bin/env python3
"""Deploy the Aviation Situation Dashboard to Netlify.

Uploads everything under site/ and every netlify/functions/*.js (each zipped on its own) with
Netlify's file-digest API. Every deploy must include the functions: a deploy without them has none.
Run from anywhere:

  pplx credentials run custom-cred:<netlify-cred> -- python3 scripts/deploy.py [--draft]

The Netlify token is supplied by the credential runner; nothing secret lives here.
--draft creates a preview deploy and prints its URL instead of publishing.
"""
import hashlib, io, os, sys, time, zipfile
import requests, urllib3

urllib3.disable_warnings()
SITE_ID = "71cd2657-d459-4a1f-bc8a-6b2cbb84aa3c"      # Netlify site "aert2800wx" (public id, not a secret)
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_DIR = os.path.join(REPO, "site")
FUNC_DIR = os.path.join(REPO, "netlify", "functions")
API = "https://api.netlify.com/api/v1"
draft = "--draft" in sys.argv

# Collect every regular file under site/, keyed by its root-relative URL path.
files, paths = {}, {}
for root, _, names in os.walk(SITE_DIR):
    for name in names:
        full = os.path.join(root, name)
        url = "/" + os.path.relpath(full, SITE_DIR).replace(os.sep, "/")
        sha = hashlib.sha1(open(full, "rb").read()).hexdigest()
        files[url] = sha
        paths[sha] = (url, full)
if not files:
    sys.exit(f"nothing to deploy: {SITE_DIR} is empty")
print(f"{len(files)} files in site/")

# Functions: one zip per file, containing <name>.js at the zip root (Lambda handler "<name>.handler").
# Fixed timestamps keep the zip bytes, and so the digest, stable when the source hasn't changed.
funcs, fzips = {}, {}
if os.path.isdir(FUNC_DIR):
    for name in sorted(os.listdir(FUNC_DIR)):
        if not name.endswith(".js"):
            continue
        fname = name[:-3]
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
            info.external_attr = 0o644 << 16
            z.writestr(info, open(os.path.join(FUNC_DIR, name), "rb").read())
        data = buf.getvalue()
        sha = hashlib.sha256(data).hexdigest()
        funcs[fname] = sha
        fzips[sha] = (fname, data)
print(f"{len(funcs)} function(s): {', '.join(funcs) or 'none'}")

body = {"files": files, "functions": funcs}
if draft:
    body["draft"] = True
dep = requests.post(f"{API}/sites/{SITE_ID}/deploys", json=body, verify=False).json()
if "id" not in dep:
    sys.exit(f"deploy create failed: {dep}")

required = dep.get("required", [])
print(f"{len(required)} changed file(s) to upload")
for sha in required:
    url, full = paths[sha]
    r = requests.put(f"{API}/deploys/{dep['id']}/files{url}",
                     headers={"Content-Type": "application/octet-stream"},
                     data=open(full, "rb").read(), verify=False)
    print(" ", url, r.status_code)

for sha in dep.get("required_functions", []) or []:
    fname, data = fzips[sha]
    r = requests.put(f"{API}/deploys/{dep['id']}/functions/{fname}?runtime=js",
                     headers={"Content-Type": "application/octet-stream"}, data=data, verify=False)
    print("  function", fname, r.status_code)
    if r.status_code >= 300:
        sys.exit(f"function upload failed: {r.text[:300]}")

for _ in range(30):
    time.sleep(4)
    s = requests.get(f"{API}/deploys/{dep['id']}", verify=False).json()
    if s.get("state") == "ready":
        print(("DRAFT: " if draft else "LIVE: ") + s.get("deploy_ssl_url", ""))
        break
    if s.get("state") == "error":
        sys.exit(f"deploy failed: {s.get('error_message')}")
else:
    sys.exit("timed out waiting for deploy to become ready")
