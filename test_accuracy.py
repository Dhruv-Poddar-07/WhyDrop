import random
from generator import make_data, REGIONS, CATEGORIES
from detective import analyze

random.seed(2)          

tests = 200             
top1 = 0
top3 = 0
not_found = 0

for i in range(tests):
    region = random.choice(REGIONS)
    category = random.choice(CATEGORIES)
    start = random.randint(20, 50)
    amount = random.uniform(0.15, 0.4)     

    df = make_data(region, category, start, amount, seed=i + 1000)   # changed: was seed=i
    result = analyze(df)
    truth = region + " -> " + category

    if not result["drop_found"]:
        not_found += 1
        print("Test", i, "- no drop found. Planted:", truth, "drop", round(amount * 100), "%")
        continue

    names = [c["segment"] for c in result["causes"]]

    if names[0] == truth:
        top1 += 1
    else:
        print("Test", i, "- wrong. Planted:", truth, "| Found:", names[0])

    if truth in names[:3]:
        top3 += 1

print()
print("Tests:", tests)
print("Top-1 correct:", top1, "/", tests, "=", round(top1 / tests * 100), "%")
print("Top-3 correct:", top3, "/", tests, "=", round(top3 / tests * 100), "%")
print("No drop found:", not_found)