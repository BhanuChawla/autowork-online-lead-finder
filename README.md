# Autowork Online Lead Finder

Internal lead prospecting tool for Klipboard's **Autowork Online** product — a cloud-based Garage Management System (GMS) for workshops and garages in the UK & Ireland.

## What It Does
- **Real-time search** — Enter any UK/Ireland city, town, or postcode to find garages, MOT centres, workshops, tyre shops, and service centres via Google Places
- **Lead scoring** — Businesses scored as Hot, Warm, or Cool based on digital presence, size, and qualification signals
- **Website scanning** — Detects competitor GMS systems (TechMan, Dragon2000, GarageHive, etc.), online booking presence, and digital maturity
- **Outreach generation** — Personalised cold email sequences, call scripts, and LinkedIn messages with Autowork Online product positioning
- **Lead claiming** — BDR ownership tracking so reps don't step on each other
- **CSV export** — Export outreach lists with all contact details and qualification data

## Target Market
- 23,000+ MOT centres in the UK
- 30,000+ independent garages
- 34% still haven't adopted digital management systems

## Stack
- **Frontend**: Vanilla HTML/CSS/JS (in `static/`)
- **Backend**: FastAPI + SQLite (`api_server.py`)
- **APIs**: Google Places, Google Geocoding

## Deployment
Designed for Railway. The backend serves the frontend from `/static` and handles API proxying, BDR auth, lead claiming, and website scanning.

Built by Klipboard.
