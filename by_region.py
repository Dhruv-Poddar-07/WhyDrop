import pandas as pd

df = pd.read_excel("sales.xlsx")
df["date"] = pd.to_datetime(df["date"])

# find the drop start
daily = df.groupby("date")["revenue"].sum()
normal = daily.rolling(14).mean().shift(1)
change = (daily - normal) / normal * 100
flagged = change[change < -3]
drop_start = flagged.index[0]

# before and after groups
days = 7
before = df[(df["date"] >= drop_start - pd.Timedelta(days=days)) & (df["date"] < drop_start)]
after = df[(df["date"] >= drop_start) & (df["date"] < drop_start + pd.Timedelta(days=days))]

total_change = after["revenue"].sum() - before["revenue"].sum()

# the new part: per region
before_region = before.groupby("region")["revenue"].sum()
after_region = after.groupby("region")["revenue"].sum()

result = pd.DataFrame({"before": before_region, "after": after_region})
result["change"] = result["after"] - result["before"]
result["share_%"] = result["change"] / total_change * 100
result = result.sort_values("change")

print("Total change:", round(total_change))
print(result.round(1))