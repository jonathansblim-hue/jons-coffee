export const MENU = {
  coffee: [
    {
      name: "Americano",
      temperatures: ["Hot", "Iced"],
      sizes: { Small: 3.0, Large: 4.0 },
    },
    {
      name: "Latte",
      temperatures: ["Hot", "Iced"],
      sizes: { Small: 4.0, Large: 5.0 },
    },
    {
      name: "Cold Brew",
      temperatures: ["Iced"],
      sizes: { Small: 4.0, Large: 5.0 },
    },
    {
      name: "Mocha",
      temperatures: ["Hot", "Iced"],
      sizes: { Small: 4.5, Large: 5.5 },
    },
    {
      name: "Coffee Frappuccino",
      temperatures: ["Iced"],
      sizes: { Small: 5.5, Large: 6.0 },
    },
  ],
  tea: [
    {
      name: "Black Tea",
      temperatures: ["Hot", "Iced"],
      sizes: { Small: 3.0, Large: 3.75 },
    },
    {
      name: "Jasmine Tea",
      temperatures: ["Hot", "Iced"],
      sizes: { Small: 3.0, Large: 3.75 },
    },
    {
      name: "Lemon Green Tea",
      temperatures: ["Hot", "Iced"],
      sizes: { Small: 3.5, Large: 4.25 },
    },
    {
      name: "Matcha Latte",
      temperatures: ["Hot", "Iced"],
      sizes: { Small: 4.5, Large: 5.25 },
    },
  ],
  pastries: [
    { name: "Plain Croissant", price: 3.5 },
    { name: "Chocolate Croissant", price: 4.0 },
    { name: "Chocolate Chip Cookie", price: 2.5 },
    { name: "Banana Bread", price: 3.0 },
  ],
  addons: [
    { name: "Whole Milk", price: 0.0, category: "milk" },
    { name: "Skim Milk", price: 0.0, category: "milk" },
    { name: "Oat Milk", price: 0.5, category: "milk" },
    { name: "Almond Milk", price: 0.75, category: "milk" },
    { name: "Extra Espresso Shot", price: 1.5, category: "shot" },
    { name: "Extra Matcha Shot", price: 1.5, category: "shot" },
    { name: "Caramel Syrup", price: 0.5, category: "syrup" },
    { name: "Hazelnut Syrup", price: 0.5, category: "syrup" },
  ],
  sweetness_levels: ["No Sugar", "Less Sugar", "Regular", "Extra Sugar"],
  ice_levels: ["No Ice", "Less Ice", "Regular", "Extra Ice"],
};

export const MENU_TEXT = `
NYC COFFEE MENU
================

☕ COFFEE                          Small (12oz)    Large (16oz)
Americano (Hot/Iced)               $3.00           $4.00
Latte (Hot/Iced)                   $4.00           $5.00
Cold Brew (Iced only)              $4.00           $5.00
Mocha (Hot/Iced)                   $4.50           $5.50
Coffee Frappuccino (Iced only)     $5.50           $6.00

🍵 TEA                             Small (12oz)    Large (16oz)
Black Tea (Hot/Iced)               $3.00           $3.75
Jasmine Tea (Hot/Iced)             $3.00           $3.75
Lemon Green Tea (Hot/Iced)         $3.50           $4.25
Matcha Latte (Hot/Iced)            $4.50           $5.25

⭐ ADD-ONS / SUBSTITUTIONS
Whole Milk                         $0.00
Skim Milk                          $0.00
Oat Milk                           +$0.50
Almond Milk                        +$0.75
Extra Espresso Shot                +$1.50
Extra Matcha Shot                  +$1.50
1 Pump Caramel Syrup               +$0.50
1 Pump Hazelnut Syrup              +$0.50

🥐 PASTRIES
Plain Croissant                    $3.50
Chocolate Croissant                $4.00
Chocolate Chip Cookie              $2.50
Banana Bread (Slice)               $3.00

🍬 Sweetness Levels: No Sugar | Less Sugar | Regular | Extra Sugar
🧊 Ice Levels: No Ice | Less Ice | Regular | Extra Ice
`;

export const DRINK_RULES = `
IMPORTANT RULES FOR ORDERING:
1. Cold Brew is ONLY available iced - it cannot be made hot.
2. Coffee Frappuccino is ONLY available iced/blended - it cannot be made hot.
3. A "Latte with no espresso shots" is essentially just steamed milk - politely inform the customer and confirm if that's what they want.
4. Maximum of 6 extra espresso shots per drink (beyond that is unsafe/unreasonable).
5. Maximum of 4 extra matcha shots per drink.
6. Maximum of 6 pumps of any syrup per drink.
7. Frappuccinos come blended with ice by default - "no ice" frappuccino doesn't make sense (you can offer less ice).
8. Hot drinks don't have ice level options.
9. Milk substitutions apply to drinks that contain milk (Latte, Mocha, Matcha Latte, Frappuccino). Americano and teas don't normally have milk unless customer requests a splash.
10. Extra Matcha Shot only applies to Matcha Latte.
11. Extra Espresso Shot applies to coffee drinks (Americano, Latte, Mocha, Cold Brew, Frappuccino), not teas.
12. Pastries have no customization options.
13. Each order should have at least 1 item.
14. All drink orders need: size (Small/Large) and temperature (Hot/Iced where applicable).
15. If a customer asks for something not on the menu, politely let them know it's not available and suggest alternatives.
16. Default milk is Whole Milk, default sweetness is Regular, default ice level is Regular (for iced drinks).
`;
