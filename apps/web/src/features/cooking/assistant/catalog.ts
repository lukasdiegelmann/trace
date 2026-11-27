/**
 * CookTrace's tool catalog, as in cooktrace/src/lib/aiChat.js. The one
 * change: its `get_diary` is `get_cook_diary` here, since NutriTrace has a
 * `get_diary` of its own.
 */
import type { ToolSpec } from "@/features/shared/ai";

export const COOKING_TOOL_SPECS = [
  // Read tools
  {
    name: "get_recipes",
    description:
      "Get the user's recipe library. Returns each recipe's id, name, description, image, servings, prep+cook minutes, rating, favorite, last_cooked_at, cook_count, category, tags, and pantry_match (have/need ingredients in stock). Use this to find a recipe by name or browse the library.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Optional case-insensitive name/description/tag filter. Omit to return all (capped at 100).",
        },
        category: {
          type: "string",
          description:
            'Optional case-insensitive category name filter (e.g. "Desserts", "Italian"). Use list_recipe_categories first to see what exists.',
        },
        favorite: {
          type: "boolean",
          description: "If true, only return favorited recipes.",
        },
      },
    },
  },
  {
    name: "list_recipe_categories",
    description:
      "List all recipe categories in the user's catalog with name, slug, color, and how many recipes are in each. Use before filtering get_recipes by category to know what's available.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_recipe",
    description:
      "Get a single recipe with full ingredients (grouped), steps, tools (Kitchen Gear), tags, source URL, notes, and per-serving nutrition.",
    parameters: {
      type: "object",
      properties: { id: { type: "integer", description: "Recipe id" } },
      required: ["id"],
    },
  },
  {
    name: "get_pantry",
    description:
      "Get the user's pantry inventory. Each item has id, name, brand, in_stock, quantity, unit, expires_on, category, serving size + nutrition (when set), barcode, and notes. Use this to answer 'do I have X?' or feed into find_recipes_from_pantry.",
    parameters: {
      type: "object",
      properties: {
        in_stock_only: {
          type: "boolean",
          description: "If true, only return items currently in stock.",
        },
        query: {
          type: "string",
          description: "Optional case-insensitive name filter.",
        },
        category: {
          type: "string",
          description:
            'Optional case-insensitive category name filter (e.g. "Dairy & Eggs", "Produce"). Use list_pantry_categories first to see what exists.',
        },
      },
    },
  },
  {
    name: "list_pantry_categories",
    description:
      "List all pantry categories in the user's catalog with name, slug, icon. Use before filtering get_pantry by category to know what's available.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "find_recipes_from_pantry",
    description:
      "Find recipes the user can mostly cook from what's currently in stock. Returns recipes ranked by pantry match ratio (have / need). Useful for 'what can I cook tonight?'.",
    parameters: {
      type: "object",
      properties: {
        min_ratio: {
          type: "number",
          description:
            "Minimum match ratio 0-1 (default 0.7 = at least 70% in stock).",
        },
      },
    },
  },
  {
    name: "get_cook_diary",
    description:
      "Get the user's cook diary (past + planned cooks) for a date range. Returns date, kind ('cooked' | 'planned'), recipe_id, recipe_name, meal_type ('breakfast' | 'lunch' | 'dinner' | 'snack' | null), rating (1-5 or null — distinct from the recipe's overall rating; this is how THIS cook turned out), servings, notes, has_photo.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date (YYYY-MM-DD)" },
        to: { type: "string", description: "End date (YYYY-MM-DD)" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "get_shopping_list",
    description:
      "Get the user's current shopping list. Each row: name, quantity, unit, aisle, checked status, pantry_id link, recipe_id, recipe_name (set when added from a recipe).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_cookbooks",
    description:
      "Get the user's cookbook collections. Returns id, name, slug, description, recipe_count, is_smart, smart_filter (for smart cookbooks).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_cookbook",
    description:
      "Get one cookbook with the recipes inside (smart cookbooks evaluate the saved filter live).",
    parameters: {
      type: "object",
      properties: { id: { type: "integer", description: "Cookbook id" } },
      required: ["id"],
    },
  },

  // Write tools
  {
    name: "log_cook",
    description:
      "Mark a recipe as cooked on a given date. Updates the recipe's last_cooked_at + cook_count and creates a cook_diary entry. Use this when the user says 'I cooked this' / 'just made the lasagna' / 'log that I made tacos last night'.",
    parameters: {
      type: "object",
      properties: {
        recipe_id: { type: "integer", description: "Recipe id" },
        date: { type: "string", description: "YYYY-MM-DD; defaults to today." },
        notes: { type: "string", description: "Optional cook notes." },
        meal_type: {
          type: "string",
          description:
            "Optional meal slot — one of 'breakfast' | 'lunch' | 'dinner' | 'snack'. Use if the user mentioned which meal it was.",
        },
        rating: {
          type: "integer",
          description:
            'Optional 1-5 rating for THIS cook (not the recipe as a whole). Use when the user says "it turned out great" / "5 stars" / "meh".',
        },
      },
      required: ["recipe_id"],
    },
  },
  {
    name: "plan_cook",
    description:
      "Schedule a recipe to be cooked on a future date (creates a kind='planned' diary entry). Use for 'plan tacos for Friday' / 'put pasta on the menu next Tuesday'.",
    parameters: {
      type: "object",
      properties: {
        recipe_id: { type: "integer", description: "Recipe id" },
        date: { type: "string", description: "YYYY-MM-DD" },
        notes: { type: "string", description: "Optional notes." },
        meal_type: {
          type: "string",
          description:
            "Optional meal slot — 'breakfast' | 'lunch' | 'dinner' | 'snack'.",
        },
      },
      required: ["recipe_id", "date"],
    },
  },
  {
    name: "add_to_shopping",
    description:
      "Add one or more items to the user's shopping list. Each item is { name, quantity?, unit?, aisle? }. The server auto-links to existing pantry rows by name (case-insensitive).",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Array of items to add.",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: 'Item name (e.g. "tomato")',
              },
              quantity: {
                type: "number",
                description: "Optional numeric quantity.",
              },
              unit: {
                type: "string",
                description: 'Optional unit (e.g. "cup", "lb").',
              },
              aisle: {
                type: "string",
                description: 'Optional aisle (e.g. "Produce").',
              },
            },
            required: ["name"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "add_to_pantry",
    description:
      "Add a new pantry item (or update an existing one by name). Use for 'I just bought 2 lbs of chicken' / 'add olive oil to my pantry'.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Item name" },
        in_stock: {
          type: "boolean",
          description: "Whether currently in stock (default true)",
        },
        quantity: { type: "number", description: "Optional numeric quantity" },
        unit: { type: "string", description: "Optional unit" },
        brand: { type: "string", description: "Optional brand" },
        notes: { type: "string", description: "Optional notes" },
      },
      required: ["name"],
    },
  },
  {
    name: "set_pantry_density",
    description:
      "Set the volume↔weight density of a pantry item (grams per cup) so the recipe nutrition auto-calc can convert across families. Use this when the user asks 'set density for everything' / 'fill in densities for the dry goods'. Pull a sane default from your training: flour ~120, sugar ~200, oil ~218, butter ~227, honey ~340, water ~240, etc. The user can override per item later.",
    parameters: {
      type: "object",
      properties: {
        pantry_id: { type: "integer", description: "Pantry item id" },
        g_per_cup: {
          type: "number",
          description: "Grams per cup. Use null/0 to clear.",
        },
      },
      required: ["pantry_id", "g_per_cup"],
    },
  },
  {
    name: "set_pantry_stock",
    description:
      "Toggle whether a pantry item is in stock. Use for 'I'm out of butter' / 'I just restocked olive oil'. Pass the pantry_id from get_pantry.",
    parameters: {
      type: "object",
      properties: {
        pantry_id: { type: "integer", description: "Pantry item id" },
        in_stock: {
          type: "boolean",
          description: "true = in stock, false = out",
        },
      },
      required: ["pantry_id", "in_stock"],
    },
  },
  {
    name: "add_to_cookbook",
    description: "Add one or more recipes to a (regular, non-smart) cookbook.",
    parameters: {
      type: "object",
      properties: {
        cookbook_id: { type: "integer", description: "Cookbook id" },
        recipe_ids: {
          type: "array",
          items: { type: "integer" },
          description: "Recipe ids to add",
        },
      },
      required: ["cookbook_id", "recipe_ids"],
    },
  },
  {
    name: "import_recipe_from_url",
    description:
      "Scrape a recipe from a public URL and save it. Works on most food blogs / publisher sites that publish schema.org/Recipe JSON-LD (which is the vast majority). Use this when the user pastes a URL or says 'import this from <site>'. The new recipe lands in their library and you should reference it by id afterwards (e.g. for log_cook).",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL of the recipe page." },
        add_to_pantry: {
          type: "boolean",
          description:
            "If true (default), auto-create pantry rows for any new ingredient names. Set false if the user wants the recipe imported in isolation.",
        },
        apply_tags: {
          type: "boolean",
          description:
            "If true, copy the publisher's tags onto the new recipe. Default false because publisher tags are usually noisy.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "create_recipe",
    description:
      "Create a brand-new recipe from scratch in chat. Use this when the user DICTATES a recipe (typed or via voice) OR attaches a photo of a cookbook page / handwritten card and asks you to import it. For a public web URL prefer import_recipe_from_url instead — it's cleaner and grabs the publisher's metadata. Ingredients should be the grouped shape: [{ name: '', items: [{ qty: '', unit: '', name: '', note: '' }, ...] }]. Steps as [{ title: '', text: '' }].",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Recipe name (required)." },
        description: {
          type: "string",
          description: "Optional 1-2 sentence description.",
        },
        servings: { type: "integer", description: "Optional servings count." },
        yield_text: {
          type: "string",
          description: 'Optional yield text, e.g. "12 cookies".',
        },
        prep_minutes: {
          type: "integer",
          description: "Optional prep minutes.",
        },
        cook_minutes: {
          type: "integer",
          description: "Optional cook minutes.",
        },
        ingredients: {
          type: "array",
          description: "Grouped ingredients. Single unnamed group is fine.",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description:
                  'Group name (e.g. "Sauce"). Empty string for default group.',
              },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    qty: {
                      type: "string",
                      description: 'Quantity ("1", "1/2", "1.5")',
                    },
                    unit: {
                      type: "string",
                      description: "Unit (cup, tbsp, oz, etc.)",
                    },
                    name: { type: "string", description: "Ingredient name" },
                    note: {
                      type: "string",
                      description: 'Optional prep note ("chopped", "sifted").',
                    },
                  },
                  required: ["name"],
                },
              },
            },
            required: ["items"],
          },
        },
        steps: {
          type: "array",
          description: "Numbered instructions.",
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: 'Optional short title (e.g. "Preheat Oven").',
              },
              text: { type: "string", description: "Step text." },
            },
            required: ["text"],
          },
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags.",
        },
        tools: {
          type: "array",
          items: { type: "string" },
          description: "Optional Kitchen Gear list.",
        },
        source_url: {
          type: "string",
          description: "Optional URL the recipe came from.",
        },
        notes: { type: "string", description: "Optional author notes." },
      },
      required: ["name", "ingredients", "steps"],
    },
  },
] as const satisfies readonly ToolSpec[];

export type CookingToolName = (typeof COOKING_TOOL_SPECS)[number]["name"];
