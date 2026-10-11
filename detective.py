import pandas as pd


def analyze(df, kpi="revenue", date_col="date", dimensions=None, days=7):
    if dimensions is None:
        dimensions = ["region", "category"]

    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])

    # 1. daily totals
    daily = df.groupby(date_col)[kpi].sum()

    # 2. find the drop start: the day with the biggest lasting step down
    values = daily.values
    best_day = None
    best_step = 0

    for i in range(7, len(values) - 4):
        before_avg = values[i - 7:i].mean()
        after_avg = values[i:i + 5].mean()
        step = (after_avg - before_avg) / before_avg * 100

        if step < best_step:
            best_step = step
            best_day = i

    if best_day is None or best_step > -2:
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

    # 4. breakdown by all dimensions together
    b = before.groupby(dimensions)[kpi].sum()
    a = after.groupby(dimensions)[kpi].sum()
    table = pd.DataFrame({"before": b, "after": a}).fillna(0)
    table["change"] = table["after"] - table["before"]
    table["change_pct"] = table["change"] / table["before"] * 100
    table["share_pct"] = table["change"] / total_change * 100

    # 5. remove tiny groups, keep only groups that dropped
    min_size = before_total * 0.02
    table = table[table["before"] >= min_size]
    causes = table[table["change"] < 0].sort_values("change")

    # 6. build the answer
    results = []
    for key, row in causes.head(5).iterrows():
        if isinstance(key, tuple):
            name = " -> ".join(str(k) for k in key)
        else:
            name = str(key)

        share = float(row["share_pct"])
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

    summary = "Most likely cause: " + results[0]["segment"] + " (" + str(results[0]["share_pct"]) + "% of the drop)"

    daily_list = [{"date": str(d.date()), "value": round(float(v), 1)} for d, v in daily.items()]

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