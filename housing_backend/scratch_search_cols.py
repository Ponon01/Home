import pandas as pd
from pathlib import Path

def dump_columns():
    path = Path("data") / "рассрочка и выкупленные общее поступление.xlsx"
    if not path.exists():
        return "File not found"
    df = pd.read_excel(path, sheet_name=0, header=None)
    headers = df.iloc[1].tolist()
    
    found = []
    for idx, h in enumerate(headers):
        if pd.isna(h):
            continue
        h_str = str(h).strip().lower()
        if any(term in h_str for term in ["факт", "оплат", "платеж", "месяц", "долг", "текущ"]):
            found.append(f"[{idx}] {h}")
    return "\n".join(found)

if __name__ == "__main__":
    result = dump_columns()
    print("Found columns:")
    print(result)
