import csv
from pathlib import Path

csv_path = Path("/Users/aayu/Plant Doctors/backend/data/generated/treatment_knowledge.csv")
rows = []
with open(csv_path, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        if row["disease_class"] == "Gudhal___healthy":
            row["crop"] = "Hibiscus (Gudhal)"
            row["summary_en"] = "Your Hibiscus (Gudhal) is perfectly healthy! Make sure to water it well regularly, keeping the soil moist but not waterlogged, and ensure good sunlight."
            row["summary_hi"] = "आपका गुड़हल (Hibiscus) पूरी तरह स्वस्थ है! इसे नियमित रूप से अच्छे से पानी (pni-wani) दें, बस मिट्टी नम रहनी चाहिए और अच्छी धूप दिखाएं।"
            row["irrigation_advice"] = "Water thoroughly when the top inch of soil feels dry."
        rows.append(row)

with open(csv_path, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print("Updated treatment_knowledge.csv")
