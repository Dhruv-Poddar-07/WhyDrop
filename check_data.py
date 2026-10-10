import pandas as pd

df = pd.read_excel("sales.xlsx")
df["date"] = pd.to_datetime(df["date"])

print(df.head())
print(df.shape)
print(df.columns)
print(df.dtypes)
print(df.isnull().sum())