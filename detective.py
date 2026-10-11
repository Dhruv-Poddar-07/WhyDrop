import pandas as pd

def analyze(df, kpi="revenue", date_col="date", dimensions=None, days=7):
    if dimensions is None:
        dimensions = ["region", "category"]

    df = df.copy() #will Make a duplicate of the table so the original is never changed

    df[date_col] = pd.to_datetime(df[date_col])

    # 1. daily totals
    daily = df.groupby(date_col)[kpi].sum()

    # 2. find when the drop start: the day with the biggest lasting step down
    values = daily.values #plain list of 60 numbers without date
    best_day = None  #to write the position from which the drop starts 
    best_step = 0  #the biggesst fall found so far

    for i in range(7, len(values) - 4):  #i.e it has range of 7 to 60 (as for a week)  , Why start at 7? We need 7 days before the candidate, and positions 0 to 6 don’t have that. Why stop at 55? We need 5 days from the candidate onward, so we can’t go past the end.

        before_avg = values[i - 7:i].mean()
        after_avg = values[i:i + 5].mean()
        step = (after_avg - before_avg) / before_avg * 100  #the main logic behind finding the drop. The percent change. Example: before average 12000, after average 11500: (11500 − 12000) ÷ 12000 × 100 = −4.2. Negative means sales fell.

        if step < best_step:
            best_step = step
            best_day = i

    if best_day is None or best_step > -2:  #If no fall was found, or the biggest fall is smaller than 2%, stop here.
        return {"drop_found": False, "message": "No significant drop found."}

    drop_start = daily.index[best_day]

    # 3. before and after groups
    before = df[(df[date_col] >= drop_start - pd.Timedelta(days=days)) & (df[date_col] < drop_start)]
    after = df[(df[date_col] >= drop_start) & (df[date_col] < drop_start + pd.Timedelta(days=days))]

    before_total = before[kpi].sum()
    after_total = after[kpi].sum()
    total_change = after_total - before_total

    if total_change >= 0:
        return {"drop_found": False, "message": "No significant drop found."}

    # 4. breakdown by all dimensions together and finding Which group caused it?
    b = before.groupby(dimensions)[kpi].sum()
    a = after.groupby(dimensions)[kpi].sum()

    table = pd.DataFrame({"before": b, "after": a}).fillna(0) #builds a table from two columns named “before” and “after”. .fillna(0) replaces any empty cell with 0
    table["change"] = table["after"] - table["before"]
    table["change_pct"] = table["change"] / table["before"] * 100
    table["share_pct"] = table["change"] / total_change * 100

    # 5. remove tiny groups, keep only groups that dropped Throw away groups smaller than 2% of total sales
    min_size = before_total * 0.02
    table = table[table["before"] >= min_size]
    causes = table[table["change"] < 0].sort_values("change")

    # 6. build the answer
    results = [] #An empty list, where we’ll collect the answer one cause at a time.
    for key, row in causes.head(5).iterrows():
        if isinstance(key, tuple): #isinstance(key, tuple) asks “is this a pair?”
            name = " -> ".join(str(k) for k in key) #" -> ".join(...) glues the parts together with an arrow between them, giving the text "Jaipur -> Vegetables". str(...) turns something into text.
        else:
            name = str(key)

        share = float(row["share_pct"])  #float(...) turns pandas’ special number into an ordinary decimal number. The web format can’t carry pandas numbers.
        if share >= 50:
            impact = "High"
        elif share >= 20:
            impact = "Medium"
        else:
            impact = "Low"

        results.append({
            "segment": name,
            "before": round(float(row["before"]), 1),
            "after": round(float(row["after"]), 1),
            "change": round(float(row["change"]), 1),
            "change_pct": round(float(row["change_pct"]), 1),
            "share_pct": round(share, 1),
            "impact": impact,
        })

    summary = "Most likely cause: " + results[0]["segment"] + " (" + str(results[0]["share_pct"]) + "% of the drop)"  #results[0] is the first (biggest) cause. ["segment"] picks its name.

    daily_list = [{"date": str(d.date()), "value": round(float(v), 1)} for d, v in daily.items()] #A one-line loop that builds a list for the chart. For each date d and total v, it makes a small dictionary {date, value}. d.date() removes the clock time.

    return {
        "drop_found": True,
        "drop_date": str(drop_start.date()),
        "before_total": round(float(before_total), 1),
        "after_total": round(float(after_total), 1),
        "total_change": round(float(total_change), 1),
        "total_change_pct": round(float(total_change / before_total * 100), 1),
        "causes": results,
        "summary": summary,
        "daily": daily_list,
    }