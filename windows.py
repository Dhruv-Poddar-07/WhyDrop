import pandas as pd

df = pd.read_excel("sales.xlsx")
df["date"] = pd.to_datetime(df["date"])

# find the drop start (same as last step)
daily = df.groupby("date")["revenue"].sum()
normal = daily.rolling(14).mean().shift(1)
change = (daily - normal) / normal * 100
flagged = change[change < -3]
drop_start = flagged.index[0]

# make the two groups of days
days = 7
before_start = drop_start - pd.Timedelta(days=days)
after_end = drop_start + pd.Timedelta(days=days)

before = df[(df["date"] >= before_start) & (df["date"] < drop_start)]
after = df[(df["date"] >= drop_start) & (df["date"] < after_end)]

print("Before:", before["date"].min().date(), "to", before["date"].max().date(), "rows:", len(before))
print("After:", after["date"].min().date(), "to", after["date"].max().date(), "rows:", len(after))

before_total = before["revenue"].sum()
after_total = after["revenue"].sum()

print("Before total:", round(before_total))
print("After total:", round(after_total))
print("Change:", round(after_total - before_total))
print("Change %:", round((after_total - before_total) / before_total * 100, 1))