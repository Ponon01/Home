import pandas as pd
from pathlib import Path

def get_headers(filename):
    path = Path("data") / filename
    if not path.exists():
        return f"File {filename} not found\n"
    
    out = []
    out.append(f"\n=== {filename} ===")
    try:
        # Load sheets
        xls = pd.ExcelFile(path)
        out.append(f"Sheets: {xls.sheet_names}")
        
        # Load first sheet
        df = pd.read_excel(path, sheet_name=0, header=None)
        out.append(f"Shape: {df.shape}")
        
        # Let's write the first 15 rows
        for idx in range(min(15, len(df))):
            row_values = df.iloc[idx].tolist()
            # replace NaN and stringify
            row_str = [str(x) if pd.notna(x) else "" for x in row_values]
            out.append(f"Row {idx}: {row_str}")
    except Exception as e:
        out.append(f"Error: {e}")
    return "\n".join(out)

if __name__ == "__main__":
    content = ""
    content += get_headers("Аренда.xlsx")
    content += "\n"
    content += get_headers("рассрочка и выкупленные общее поступление.xlsx")
    
    Path("scratch_print_output.txt").write_text(content, encoding="utf-8")
    print("Done writing scratch_print_output.txt")
