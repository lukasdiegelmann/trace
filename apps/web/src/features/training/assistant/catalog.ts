/**
 * The LiftTrace tools of the assistant, as LiftTrace's `src/lib/aiTools.js`
 * declares them (names, descriptions and parameters unchanged).
 */
import type { ToolSpec } from "@/features/shared/ai";

export const TOOL_SPECS: ToolSpec[] = [
  // ── READ ──
  {
    name: "get_workouts",
    description:
      "List the user's recent workouts with completed sets, per-exercise volume, and top set. Use whenever they ask about past sessions, recent training, or how a lift has been going. Defaults to the last 30 days. Filter by exercise_name to narrow to one lift.",
    parameters: {
      type: "object",
      properties: {
        date_from: {
          type: "string",
          description:
            "Inclusive YYYY-MM-DD. Omit unless the user named a date or period; defaults to 30 days ago, and with exercise_name reaches further back if needed.",
        },
        date_to: {
          type: "string",
          description:
            "Inclusive YYYY-MM-DD. Omit unless the user named a date or period; defaults to today.",
        },
        exercise_name: {
          type: "string",
          description:
            "Case-insensitive substring match; only workouts containing this exercise are returned.",
        },
      },
    },
  },
  {
    name: "get_workout",
    description:
      "Get one workout in full detail by id, every set, notes, coach feedback (if any), and program context. Use after get_workouts to pull specifics.",
    parameters: {
      type: "object",
      properties: { id: { type: "integer", description: "workout_log id" } },
      required: ["id"],
    },
  },
  {
    name: "get_exercises",
    description:
      "Search the exercise catalog (wger, free-exercise-db, exercisedb variants, custom). Returns compact rows with id, name, muscles, equipment, and source. Use to look up an exercise by name or filter by muscle/equipment before calling get_exercise for full detail.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Case-insensitive name substring.",
        },
        muscle: {
          type: "string",
          description: 'Primary-muscle filter (e.g. "chest", "quads").',
        },
        equipment: {
          type: "string",
          description: 'Equipment filter (e.g. "barbell", "dumbbell").',
        },
        source: {
          type: "string",
          description:
            "One of 'wger' | 'free-exercise-db' | 'exercisedb' | 'exercisedb-oss' | 'custom'.",
        },
        limit: {
          type: "integer",
          description: "Max rows to return. Default 20, cap 100.",
        },
      },
    },
  },
  {
    name: "get_exercise",
    description:
      "Get a single exercise's full detail, description, instructions, muscles, equipment, and a small list of similar exercises. Pass either id or name (id wins if both are given).",
    parameters: {
      type: "object",
      properties: {
        id: { type: "integer", description: "exercises.id" },
        name: {
          type: "string",
          description: "Exact-ish name, first case-insensitive match is used.",
        },
      },
    },
  },
  {
    name: "get_programs",
    description:
      "List all programs in the user's library with goal, template count, weeks, and which one is currently active. Use before switching programs or referencing a program by name.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_program",
    description:
      "Get one program with every template (day) laid out, target sets/reps/load/RPE/tempo/rest per exercise, plus per-week overrides if the program is multi-week. Use to explain what the program is or preview an upcoming day.",
    parameters: {
      type: "object",
      properties: { id: { type: "integer", description: "programs.id" } },
      required: ["id"],
    },
  },
  {
    name: "get_active_program",
    description:
      "Get the user's currently active program in full (same shape as get_program). Returns { active: false } if none is active. Prefer this over get_programs+get_program when the user says 'my program' / 'today's plan'.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_prs",
    description:
      "List personal records, top weight, top reps at that weight, and estimated 1RM per exercise. Filter by exercise_name and/or date range. Use for 'what's my bench PR?' / 'recent PRs' / 'top lifts this month'.",
    parameters: {
      type: "object",
      properties: {
        exercise_name: {
          type: "string",
          description: "Case-insensitive substring filter on exercise name.",
        },
        date_from: {
          type: "string",
          description: "Inclusive YYYY-MM-DD; only PRs set on/after this date.",
        },
        date_to: {
          type: "string",
          description:
            "Inclusive YYYY-MM-DD; only PRs set on/before this date.",
        },
        limit: {
          type: "integer",
          description: "Max rows to return. Default 20.",
        },
      },
    },
  },
  {
    name: "get_body_stats",
    description:
      "Get body stats over time, weight, body_fat, or any tracked measurement. Returns time series + summary (first, last, min, max, absolute + percent change) when a single stat is queried.",
    parameters: {
      type: "object",
      properties: {
        stat: {
          type: "string",
          description:
            "Optional single-stat filter (e.g. 'weight', 'body_fat', 'chest').",
        },
        date_from: {
          type: "string",
          description:
            "Inclusive YYYY-MM-DD. Omit unless the user named a date or period; defaults to 90 days ago.",
        },
        date_to: {
          type: "string",
          description:
            "Inclusive YYYY-MM-DD. Omit unless the user named a date or period; defaults to today.",
        },
      },
    },
  },
  {
    name: "get_progress_photos",
    description:
      "List the user's progress photos in a date range: how many, on which dates, and the weight logged that day when there is one. Returns metadata only, never image content, so use it for consistency and trend questions ('how often am I taking photos?', 'when did I last take one?', 'what did I weigh at my first and latest photo?'). You cannot see the images themselves; if the user wants you to look at one, ask them to attach it to a message.",
    parameters: {
      type: "object",
      properties: {
        date_from: {
          type: "string",
          description:
            "Inclusive YYYY-MM-DD. Omit unless the user named a date or period; defaults to 365 days ago.",
        },
        date_to: {
          type: "string",
          description:
            "Inclusive YYYY-MM-DD. Omit unless the user named a date or period; defaults to today.",
        },
      },
    },
  },
  {
    name: "get_cardio",
    description:
      "Get logged cardio sessions in a date range: activity, duration, distance, average heart rate and notes, plus totals per activity. Cardio is logged separately from lifting and does NOT appear in get_workouts, so check here before commenting on conditioning, weekly training load, or recovery.",
    parameters: {
      type: "object",
      properties: {
        date_from: {
          type: "string",
          description:
            "Inclusive YYYY-MM-DD. Omit unless the user named a date or period; defaults to 30 days ago.",
        },
        date_to: {
          type: "string",
          description:
            "Inclusive YYYY-MM-DD. Omit unless the user named a date or period; defaults to today.",
        },
        activity: {
          type: "string",
          description:
            "Optional case-insensitive filter, e.g. 'run', 'cycling'.",
        },
      },
    },
  },
  {
    name: "log_cardio",
    description:
      "Log a cardio session. Use for runs, rides, rowing, walking, swimming and similar. Do NOT use log_workout or log_set for these; they are for resistance training.",
    parameters: {
      type: "object",
      required: ["activity", "duration_min"],
      properties: {
        activity: {
          type: "string",
          description: "Activity name, e.g. 'Running', 'Cycling'.",
        },
        duration_min: {
          type: "number",
          description: "Duration in whole minutes. Required, must be positive.",
        },
        distance: { type: "number", description: "Optional distance covered." },
        distance_unit: {
          type: "string",
          description: "'km' or 'mi'. Defaults to km.",
        },
        avg_hr: {
          type: "number",
          description: "Optional average heart rate in bpm.",
        },
        notes: { type: "string", description: "Optional free-text note." },
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        date_confirmed: {
          type: "boolean",
          description:
            "Only after the user confirmed a date more than 60 days from today.",
        },
      },
    },
  },
  {
    name: "get_stats_overview",
    description:
      "Snapshot the user's training over a window: workouts done, current + best streak, weekly averages, weekly volume + frequency series, muscle-group balance (with imbalance %), and top PRs set in range. Use for 'how am I doing?' / 'weekly summary'.",
    parameters: {
      type: "object",
      properties: {
        range: {
          type: "string",
          description:
            "One of '7d' | '30d' | '90d' | '1y' | 'all'. Default '30d'.",
        },
      },
    },
  },
  {
    name: "get_coach_prescription",
    description:
      "Get the coach-prescribed workout for a given date (default today) if the user has a trainer. Returns { prescribed: false } if none was set. Use before generating a workout so any coach direction is honored.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
      },
    },
  },

  // ── WRITE ──
  {
    name: "log_workout",
    description:
      "Commit a full workout to the diary for a specific date. Each exercise carries its sets [{weight, reps, rpe?, warmup?, completed?}]. For a timed exercise (plank, wall sit, dead hang, carry) send duration_sec in seconds instead of reps. Exercise names are resolved case-insensitively against the library; unknown names error out so the user can confirm before a custom row is created. Use when they say 'log today' / 'I did X, Y, Z'.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD." },
        date_confirmed: {
          type: "boolean",
          description:
            "Only after the user confirmed a date more than 60 days from today.",
        },
        name: { type: "string", description: "Optional session name." },
        duration_min: {
          type: "number",
          description: "Optional session duration in minutes.",
        },
        exercises: {
          type: "array",
          description: "Ordered list of exercises with their sets.",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description:
                  "Exercise name; matched case-insensitively against the library.",
              },
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    weight: {
                      type: "number",
                      description: "Load in the user's unit (kg or lbs).",
                    },
                    reps: {
                      type: "integer",
                      description: "Reps performed. Omit for a timed set.",
                    },
                    duration_sec: {
                      type: "integer",
                      description:
                        "Seconds held, for timed exercises (plank, wall sit, dead hang, carry). Send instead of reps.",
                    },
                    rpe: { type: "number", description: "Optional RPE 1-10." },
                    warmup: {
                      type: "boolean",
                      description:
                        "Warm-up set (excluded from volume/PRs). Default false.",
                    },
                    completed: {
                      type: "boolean",
                      description:
                        "Whether the set was completed. Default true.",
                    },
                  },
                  required: ["weight"],
                },
              },
            },
            required: ["name", "sets"],
          },
        },
      },
      required: ["date", "exercises"],
    },
  },
  {
    name: "add_exercise_to_diary",
    description:
      "Quick-add one exercise to a diary day (default today) with no sets yet, the user will fill sets in the diary. Creates the workout for that date if one doesn't exist. Use for 'add bench to today' / 'put squat on my log'.",
    parameters: {
      type: "object",
      properties: {
        exercise_name: {
          type: "string",
          description:
            "Exercise name; matched case-insensitively against the library.",
        },
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        date_confirmed: {
          type: "boolean",
          description:
            "Only after the user confirmed a date more than 60 days from today.",
        },
      },
      required: ["exercise_name"],
    },
  },
  {
    name: "log_set",
    description:
      "Append a single set to an exercise already in a workout. Identify the exercise by exercise_id (its id within the workout's exercises array, 0-based) or by exercise_name. Use for 'add another set of 5 at 225' / 'I hit one more'.",
    parameters: {
      type: "object",
      properties: {
        workout_id: { type: "integer", description: "workout_log id." },
        exercise_id: {
          type: "integer",
          description: "Position of the exercise within the workout (0-based).",
        },
        exercise_name: {
          type: "string",
          description:
            "Alternative to exercise_id, resolved by case-insensitive name match.",
        },
        weight: { type: "number", description: "Load." },
        reps: { type: "integer", description: "Reps. Omit for a timed set." },
        duration_sec: {
          type: "integer",
          description:
            "Seconds held, for a timed exercise (plank, wall sit, dead hang, carry). Send instead of reps.",
        },
        rpe: { type: "number", description: "Optional RPE 1-10." },
        warmup: { type: "boolean", description: "Warm-up set. Default false." },
        completed: { type: "boolean", description: "Completed. Default true." },
      },
      required: ["workout_id", "weight"],
    },
  },
  {
    name: "log_body_stat",
    description:
      "Record a body-stat measurement (weight, body_fat, chest, waist, etc.) for a given date. Merges with any existing stats for that date. Use for 'weighed in at 182 today' / 'body-fat is 15%'.",
    parameters: {
      type: "object",
      properties: {
        stat: {
          type: "string",
          description:
            "Stat name, 'weight', 'body_fat', or any custom measurement.",
        },
        value: { type: "number", description: "Numeric value." },
        unit: {
          type: "string",
          description:
            "Optional unit override. Defaults: 'kg' for weight, '%' for body_fat.",
        },
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        date_confirmed: {
          type: "boolean",
          description:
            "Only after the user confirmed a date more than 60 days from today.",
        },
        note: {
          type: "string",
          description: "Optional free-text note attached to the entry.",
        },
      },
      required: ["stat", "value"],
    },
  },
  {
    name: "start_workout_from_template",
    description:
      "Load a workout template into a diary day (default today) so the user can execute it. It fills the workout open in the diary when that one is empty; otherwise it starts a new workout of the day (new_workout: true). On the day open in the diary, the diary then shows it and later tools write into it; on another day, log sets into it with log_set and the workout_id returned. Pass template_id or template_name (resolved against the user's programs' templates). Use for 'load push day' / 'start Day A'.",
    parameters: {
      type: "object",
      properties: {
        template_id: { type: "integer", description: "workout_templates.id" },
        template_name: {
          type: "string",
          description:
            "Case-insensitive template name match across the user's programs.",
        },
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        date_confirmed: {
          type: "boolean",
          description:
            "Only after the user confirmed a date more than 60 days from today.",
        },
      },
    },
  },
  {
    name: "set_active_program",
    description:
      "Switch the user's active program. Pass program_id or program_name. Deactivates the previously active program. Use for 'switch me to 5/3/1' / 'start the Push-Pull-Legs program'.",
    parameters: {
      type: "object",
      properties: {
        program_id: { type: "integer", description: "programs.id" },
        program_name: {
          type: "string",
          description: "Case-insensitive program name match.",
        },
      },
    },
  },
  {
    name: "add_coach_prescription",
    description:
      "COACH ONLY. Prescribe a workout template to a trainee on a target date. Fails with a clear error if the caller is not a trainer/admin or does not coach the trainee. Use when the coach says 'prescribe Push Day to Alex for Friday'.",
    parameters: {
      type: "object",
      properties: {
        trainee_id: {
          type: "integer",
          description: "The member (users.id) to prescribe to.",
        },
        template_id: {
          type: "integer",
          description: "workout_templates.id to prescribe.",
        },
        target_date: {
          type: "string",
          description: "YYYY-MM-DD the trainee should perform the workout.",
        },
        date_confirmed: {
          type: "boolean",
          description:
            "Only after the user confirmed a date more than 60 days from today.",
        },
        notes: {
          type: "string",
          description: "Optional coach notes for the trainee.",
        },
      },
      required: ["trainee_id", "template_id", "target_date"],
    },
  },
];
