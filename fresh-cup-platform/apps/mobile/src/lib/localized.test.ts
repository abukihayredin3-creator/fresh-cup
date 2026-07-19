import { localizedText } from "./localized";

describe("localizedText", () => {
  it("returns the English text for the en locale", () => {
    expect(localizedText("Mango Sunrise", "የማንጎ ፀሐይ መውጣት", "en")).toBe("Mango Sunrise");
  });

  it("returns the Amharic text for the am locale when present", () => {
    expect(localizedText("Mango Sunrise", "የማንጎ ፀሐይ መውጣት", "am")).toBe("የማንጎ ፀሐይ መውጣት");
  });

  it("falls back to English when the Amharic translation is missing", () => {
    expect(localizedText("Mango Sunrise", null, "am")).toBe("Mango Sunrise");
  });
});
