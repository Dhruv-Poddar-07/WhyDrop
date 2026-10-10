import pandas as pd

df = pd.read_excel("sales.xlsx")
df["date"] = pd.to_datetime(df["date"])

daily = df.groupby("date")["revenue"].sum()

print(daily.head())
print(daily.tail())
print("Number of days:", len(daily))

print("Average before day 35:", daily.iloc[:35].mean())
print("Average after day 35:", daily.iloc[35:].mean())

import matplotlib.pyplot as plt
daily.plot()
plt.show()