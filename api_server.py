#!/usr/bin/env python3
"""Autowork Online Lead Finder API — BDR auth, lead claiming, ownership tracking, website scanning."""
import sqlite3, json, os, httpx, re
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "leads.db")

BDR_LIST = [
    {"name": "Bhanu Chawla", "email": "bhanu.chawla@klipboard.com"},
]

def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.execute("""CREATE TABLE IF NOT EXISTS claimed_leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id TEXT NOT NULL UNIQUE,
        lead_name TEXT NOT NULL,
        lead_address TEXT DEFAULT '',
        lead_phone TEXT DEFAULT '',
        lead_website TEXT DEFAULT '',
        lead_score INTEGER DEFAULT 0,
        lead_category TEXT DEFAULT '',
        lead_size TEXT DEFAULT '',
        bdr_email TEXT NOT NULL,
        bdr_name TEXT NOT NULL,
        hubspot_status TEXT DEFAULT 'not_created',
        notes TEXT DEFAULT '',
        claimed_at TEXT NOT NULL
    )""")
    db.commit()
    db.close()

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class LoginRequest(BaseModel):
    email: str

class ClaimRequest(BaseModel):
    place_id: str
    lead_name: str
    lead_address: str = ""
    lead_phone: str = ""
    lead_website: str = ""
    lead_score: int = 0
    lead_category: str = ""
    lead_size: str = ""
    bdr_email: str
    bdr_name: str

class HubspotStatusUpdate(BaseModel):
    place_id: str
    hubspot_status: str  # not_created | created | synced
    bdr_email: str

class NoteUpdate(BaseModel):
    place_id: str
    notes: str
    bdr_email: str

class ScanWebsiteRequest(BaseModel):
    url: str


@app.post("/api/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    bdr = next((b for b in BDR_LIST if b["email"].lower() == email), None)
    if not bdr:
        raise HTTPException(status_code=401, detail="Email not recognised. Please use your Klipboard email.")
    return {"name": bdr["name"], "email": bdr["email"]}

@app.get("/api/claims")
def get_claims():
    db = get_db()
    rows = db.execute("SELECT * FROM claimed_leads ORDER BY claimed_at DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.get("/api/claims/{bdr_email}")
def get_my_claims(bdr_email: str):
    db = get_db()
    rows = db.execute("SELECT * FROM claimed_leads WHERE bdr_email = ? ORDER BY claimed_at DESC", [bdr_email.lower()]).fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.post("/api/claim", status_code=201)
def claim_lead(req: ClaimRequest):
    db = get_db()
    existing = db.execute("SELECT bdr_name, bdr_email FROM claimed_leads WHERE place_id = ?", [req.place_id]).fetchone()
    if existing:
        db.close()
        raise HTTPException(status_code=409, detail=f"Already claimed by {existing['bdr_name']}")
    db.execute(
        "INSERT INTO claimed_leads (place_id, lead_name, lead_address, lead_phone, lead_website, lead_score, lead_category, lead_size, bdr_email, bdr_name, claimed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [req.place_id, req.lead_name, req.lead_address, req.lead_phone, req.lead_website, req.lead_score, req.lead_category, req.lead_size, req.bdr_email.lower(), req.bdr_name, datetime.utcnow().isoformat()]
    )
    db.commit()
    db.close()
    return {"status": "claimed", "bdr_name": req.bdr_name}

@app.put("/api/hubspot-status")
def update_hubspot_status(req: HubspotStatusUpdate):
    db = get_db()
    row = db.execute("SELECT bdr_email FROM claimed_leads WHERE place_id = ?", [req.place_id]).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Lead not found")
    if row["bdr_email"] != req.bdr_email.lower():
        db.close()
        raise HTTPException(status_code=403, detail="Only the claiming BDR can update HubSpot status")
    db.execute("UPDATE claimed_leads SET hubspot_status = ? WHERE place_id = ?", [req.hubspot_status, req.place_id])
    db.commit()
    db.close()
    return {"status": "updated"}

@app.put("/api/notes")
def update_notes(req: NoteUpdate):
    db = get_db()
    row = db.execute("SELECT bdr_email FROM claimed_leads WHERE place_id = ?", [req.place_id]).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Lead not found")
    if row["bdr_email"] != req.bdr_email.lower():
        db.close()
        raise HTTPException(status_code=403, detail="Only the claiming BDR can update notes")
    db.execute("UPDATE claimed_leads SET notes = ? WHERE place_id = ?", [req.notes, req.place_id])
    db.commit()
    db.close()
    return {"status": "updated"}


# ---- WEBSITE SCANNING (Digital Readiness for Garages) ----

GMS_BRANDS = ['techman', 'dragon2000', 'garagehive', 'mam software', 'motasoft',
              'workshop software', 'garage manager', 'iautomate', 'gemini systems',
              'pinnacle', 'autowork']

BOOKING_WIDGETS = ['bookingflow', 'simplybook', 'calendly', 'bookinglive',
                   'online booking', 'book now', 'book your mot', 'book online',
                   'book a service']

AUTOMOTIVE_INDICATORS = ['mot', 'service', 'repair', 'diagnostic', 'brake',
                         'exhaust', 'tyre', 'clutch', 'gearbox', 'bodywork']

MODERN_TECH_SIGNALS = ['react', 'angular', 'vue', 'next.js', 'tailwind',
                       'cloudflare', 'aws', 'stripe', 'google analytics',
                       'hubspot', 'mailchimp']

TECH_STACK_BUILDERS = ['wordpress', 'wix', 'squarespace', 'weebly', 'godaddy']

BASIC_SITE_SIGNALS = ['under construction', 'coming soon', 'website coming',
                      'call us for', 'phone for prices']

B2B_INDICATORS = ['trade account', 'wholesale', 'fleet', 'contract work',
                  'trade customer', 'trade price', 'b2b', 'fleet management',
                  'company vehicle', 'fleet discount']

SOCIAL_PLATFORMS = {
    'facebook': ['facebook.com', 'fb.com'],
    'instagram': ['instagram.com'],
    'linkedin': ['linkedin.com'],
    'twitter': ['twitter.com', 'x.com']
}

SCAN_DISCLAIMER = (
    "GMS detection is based on scanning the homepage for known brand signatures. "
    "Many GMS systems are backend-only and leave no trace on the website. "
    "Always confirm during outreach."
)


def analyse_html(content: str, url: str) -> dict:
    """Analyse HTML content for garage-specific digital readiness signals."""
    lower = content.lower()
    results = {
        'gmsDetected': False,
        'gmsName': '',
        'hasOnlineBooking': False,
        'digitalReadiness': 'low',
        'readinessScore': 0,
        'hasBasicSiteOnly': False,
        'automotiveSignals': [],
        'techStack': [],
        'b2bIndicators': [],
        'socialMedia': {'facebook': False, 'instagram': False, 'linkedin': False, 'twitter': False},
        'socialCount': 0,
        'multipleLocations': False,
        'signals': [],
        'disclaimer': SCAN_DISCLAIMER
    }
    score = 0

    # --- GMS brand detection ---
    detected_gms = []
    for brand in GMS_BRANDS:
        if brand in lower:
            detected_gms.append(brand)
    if detected_gms:
        results['gmsDetected'] = True
        results['gmsName'] = detected_gms[0].title()
        score += 15
        results['signals'].append('GMS detected: ' + ', '.join(b.title() for b in detected_gms))

    # --- Online booking detection ---
    booking_found = [b for b in BOOKING_WIDGETS if b in lower]
    if booking_found:
        results['hasOnlineBooking'] = True
        score += 20
        results['signals'].append('Online booking capability detected')

    # --- Basic site signals (low digital maturity) ---
    basic_found = [s for s in BASIC_SITE_SIGNALS if s in lower]
    if basic_found:
        results['hasBasicSiteOnly'] = True
        results['signals'].append('Basic/outdated website detected')
    else:
        score += 10

    # --- Automotive indicators ---
    auto_found = []
    for indicator in AUTOMOTIVE_INDICATORS:
        pattern = r'\b' + re.escape(indicator) + r'\b'
        if re.search(pattern, lower):
            auto_found.append(indicator)
    results['automotiveSignals'] = auto_found
    if auto_found:
        score += min(len(auto_found) * 3, 15)
        results['signals'].append('Automotive services: ' + ', '.join(auto_found[:6]))

    # --- Modern tech + site builders ---
    for t in MODERN_TECH_SIGNALS:
        if t in lower:
            results['techStack'].append(t.capitalize())
    for t in TECH_STACK_BUILDERS:
        if t in lower:
            results['techStack'].append(t.capitalize())
    results['techStack'] = list(set(results['techStack']))
    if results['techStack']:
        score += min(len(results['techStack']) * 5, 15)
        results['signals'].append('Tech detected: ' + ', '.join(results['techStack'][:5]))

    # --- B2B / fleet indicators ---
    for ind in B2B_INDICATORS:
        if ind in lower:
            results['b2bIndicators'].append(ind)
    results['b2bIndicators'] = list(set(results['b2bIndicators']))
    if results['b2bIndicators']:
        score += 5
        results['signals'].append('B2B/fleet signals: ' + ', '.join(results['b2bIndicators']))

    # --- Social media ---
    for platform, urls in SOCIAL_PLATFORMS.items():
        for u in urls:
            if u in lower:
                results['socialMedia'][platform] = True
    results['socialCount'] = sum(1 for v in results['socialMedia'].values() if v)
    if results['socialCount'] > 0:
        score += min(results['socialCount'] * 5, 15)
        platforms = [k for k, v in results['socialMedia'].items() if v]
        results['signals'].append('Social presence: ' + ', '.join(platforms))

    # --- Multiple locations ---
    location_words = ['branch', 'branches', 'garage', 'garages', 'workshop', 'workshops',
                      'location', 'locations', 'site', 'sites', 'centre', 'centres']
    for w in location_words:
        pattern = r'\b(multiple|several|our)\s+' + w + r'|\d+\s+' + w
        if re.search(pattern, lower, re.IGNORECASE):
            results['multipleLocations'] = True
            score += 5
            results['signals'].append('Multiple locations detected')
            break

    # --- SSL ---
    if url.startswith('https'):
        score += 5

    score = max(0, min(100, score))
    results['readinessScore'] = score
    if score >= 60:
        results['digitalReadiness'] = 'high'
    elif score >= 30:
        results['digitalReadiness'] = 'medium'
    else:
        results['digitalReadiness'] = 'low'

    return results


@app.post("/api/scan-website")
async def scan_website(req: ScanWebsiteRequest):
    """Fetch a website server-side and analyse it for garage digital readiness signals."""
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    # Ensure URL has scheme
    if not url.startswith('http'):
        url = 'https://' + url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, verify=False) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html = resp.text
    except httpx.TimeoutException:
        raise HTTPException(status_code=422, detail="Website timed out after 15 seconds")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=422, detail=f"Website returned HTTP {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch website: {str(e)}")

    results = analyse_html(html, url)
    return results



# --- GOOGLE API PROXY (keeps API key server-side) ---
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

class GeocodeRequest(BaseModel):
    address: str

class PlacesSearchRequest(BaseModel):
    text_query: str
    latitude: float
    longitude: float
    radius: float

@app.post("/api/geocode")
async def proxy_geocode(req: GeocodeRequest):
    """Proxy geocoding requests to keep API key server-side."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="Google API key not configured")
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={req.address}&key={GOOGLE_API_KEY}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url)
        return resp.json()

@app.post("/api/places-search")
async def proxy_places_search(req: PlacesSearchRequest):
    """Proxy Google Places Text Search to keep API key server-side."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="Google API key not configured")
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.id,places.location,places.businessStatus"
    }
    body = {
        "textQuery": req.text_query,
        "locationBias": {
            "circle": {
                "center": {"latitude": req.latitude, "longitude": req.longitude},
                "radius": req.radius
            }
        }
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, headers=headers, json=body)
        return resp.json()


# --- Serve static frontend ---
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/{path:path}")
async def serve_static_fallback(path: str):
    file_path = os.path.join(STATIC_DIR, path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
