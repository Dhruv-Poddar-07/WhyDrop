import pandas as pd

df = pd.read_excel("sales.xlsx")
df["date"] = pd.to_datetime(df["date"])

daily = df.groupby("date")["revenue"].sum()

normal = daily.rolling(14).mean().shift(1)
change = (daily - normal) / normal * 100

flagged = change[change < -3]

print("Percent change vs normal (last 30 days):")
print(change.round(1).tail(30))

print("Days flagged:")
print(flagged.round(1))

if len(flagged) > 0:
    print("Drop starts on:", flagged.index[0].date())
else:
    print("No drop found")