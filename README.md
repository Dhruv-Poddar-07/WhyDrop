# WhyDrop: KPI Root-Cause Analysis Engine

Upload an Excel sales file. WhyDrop finds **when** a KPI dropped, **where** the drop came from, and **which segments contributed most**, with no AI or LLM involved.

![WhyDrop screenshot](screenshot.png)

## What it does
1. Reads an Excel (.xlsx) file with the columns `date, region, category, revenue`
2. Detects the day of the largest lasting drop in total sales
3. Compares the 7 days before and after the drop
4. Breaks the change down by every region and category combination
5. Ignores tiny segments and ranks the rest by share of the drop
6. Shows the result with a chart and a ranked table

## How it works
- **Drop detection:** for each day, compare the average of the 7 days before with the average of the 5 days from that day on. The day with the largest lasting step down is the drop day.
- **Contribution analysis:** share = segment change / total change.
- **Noise filter:** segments under 2% of total sales are ignored.
- **Impact label:** High (50% or more of the drop), Medium (20% or more), Low (below 20%).

## Tech
Python, Pandas, NumPy, Flask (backend) and React, Recharts (frontend).

## Run it
Backend:
```
pip install -r requirements.txt
python app.py
```
Frontend, in a second terminal:
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 and upload the included `sales.xlsx`.

## Limitations
- Tried only on a few sample files, not validated on real business data.
- Column names are fixed: `date, region, category, revenue`.
- Drops smaller than about 2% of total sales are not detected.
- Gradual declines are not detected, only sudden drops.
- It shows where the change happened, not the real-world reason for it.

## Future work
- Let the user pick columns, so any Excel file works
- A drop threshold that adapts to each file's normal variation
- Statistical significance checks for each segment