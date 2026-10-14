# ProductSync — PIM Hackathon Prototype

ProductSync is a responsive, local-first Product Information Management (PIM) prototype designed for an individual hackathon submission.

## Run it
1. Download and extract `ProductSync_PIM.zip`.
2. Open the extracted `ProductSync_PIM` folder in VS Code.
3. Confirm the three files are together: `index.html`, `style.css`, and `app.js`.
4. Double-click `index.html` to open it in Chrome/Edge, or use VS Code Live Server.
5. No package installation, account, backend, or API credentials are required.

## Files
- `index.html` — semantic page structure and forms.
- `style.css` — responsive UI and component styling.
- `app.js` — catalog behavior, validation, local persistence, data quality, mock sync, logs and import/export.
- `README.md` — setup, features, limitations and demo checklist.

## Features included
- Dashboard metrics and catalog health indicator.
- Product CRUD (create, view, update, delete).
- Product master data: name, unique SKU, category, brand, price, lifecycle status, color, variant, GTIN, image URL, description, tags and custom attributes.
- Search across name, SKU, brand, description and tags.
- Filters for category, lifecycle status and data quality.
- Bulk selection, activate/draft and delete actions.
- Required-field validation, non-negative price validation, duplicate SKU detection and image URL validation.
- Data Quality Center with issue list and edit/review action.
- Category management and shared attribute dictionary.
- Mock channel sync with ready/blocked results and reset action.
- Activity log.
- CSV export, JSON backup and JSON import.
- Responsive layout for desktop and mobile.
- Browser `localStorage` persistence.

## Storage and integration limitations
This is a front-end prototype. Product records, categories, attribute definitions and activity logs are stored in the current browser profile using `localStorage`. They are not shared across devices or users. Browser storage can be removed by clearing site data, so export JSON backups.

The WooCommerce connector is a clearly labelled simulation. No real WooCommerce API is called and no external product publishing occurs. A production integration would require a backend, secure API credential storage, authenticated API requests, server-side validation, retry/error handling, and mapping PIM attributes to WooCommerce product fields.

## Suggested demo sequence
1. Add a complete product such as Wireless Headphones / WH-101 / Electronics / ₹1499.
2. Attempt a duplicate SKU and show that validation prevents it.
3. Edit the product and demonstrate search/filter.
4. Open Data Quality and review the product.
5. Add a custom category or attribute definition.
6. Run the mock sync and explain the local-only simulation.
7. Refresh the browser to show persistence.
8. Export CSV and JSON backup.

## AI-assisted development disclosure
If asked, explain that AI tools helped draft and refine parts of the code. You should personally inspect, run, test and understand the code before submission. Do not claim an AI agent is implemented: this version has no live AI model or agent integration.
